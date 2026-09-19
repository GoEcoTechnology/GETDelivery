import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cartItems, deliveryOrders, deliveryItems, products, productVariants, customers, users, deliveryBatches, deliveryBatchItems, vehicles, tenants } from '@/db/schema';
import { eq, inArray, sql, and, gte, asc } from 'drizzle-orm';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, tenantId: checkoutTenantId, addressText, dropoffLat, dropoffLng, dropoffLandmark, deliveryPriority, urgentReason, pickupLocation, deliveryDate, normalDeliveryFee, urgentAdditionalFee, checkoutItems } = body;

    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    // Get customer using userId (since customerId here comes from the logged-in user session)
    let [customer] = await db.select().from(customers).where(eq(customers.userId, customerId));
    
    if (!customer) {
      // Lazy create the customer record using the provided checkoutTenantId, or find any valid tenant
      let customerTenantId = checkoutTenantId;
      if (!customerTenantId) {
        const [anyTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
        customerTenantId = anyTenant?.id || 1;
      }
      
      // Fetch user details to populate customer record
      const [user] = await db.select().from(users).where(eq(users.id, customerId));
      
      if (!user) {
        return NextResponse.json({ error: 'User session invalid. Please log out and log in again.' }, { status: 401 });
      }
      
      const [newCustomer] = await db.insert(customers).values({
        userId: customerId,
        tenantId: customerTenantId,
        name: user?.name || 'Guest Customer',
        mobileNumber: user?.contactNumber || 'N/A',
        address: addressText || 'N/A',
        status: 'ACTIVE'
      }).returning();
      
      customer = newCustomer;
    }
    
    // Update customer address and coordinates if provided
    if (addressText && (addressText !== customer.address || dropoffLat || dropoffLng)) {
        await db.update(customers).set({
            address: addressText,
        }).where(eq(customers.id, customer.id));
        customer.address = addressText;
    }

    let items = [];

    if (checkoutItems && Array.isArray(checkoutItems) && checkoutItems.length > 0) {
      items = checkoutItems;
    } else {
      // Fallback: Get cart items from database if not provided explicitly
      items = await db
        .select({
          cartItemId: cartItems.id,
          quantity: cartItems.quantity,
          productId: products.id,
          variantId: productVariants.id,
          price: productVariants.price,
          tenantId: products.tenantId,
          unit: productVariants.unit,
          productName: products.name,
        })
        .from(cartItems)
        .innerJoin(products, eq(cartItems.productId, products.id))
        .innerJoin(productVariants, eq(cartItems.variantId, productVariants.id))
        .where(eq(cartItems.customerId, customer.id));
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    // Group items by tenantId (and optionally filter to just one tenant)
    const itemsByTenant: Record<number, typeof items> = {};
    for (const item of items) {
      // If checkoutTenantId is specified, only process that tenant's items
      if (checkoutTenantId && String(item.tenantId) !== String(checkoutTenantId)) continue;
      if (!itemsByTenant[item.tenantId]) {
        itemsByTenant[item.tenantId] = [];
      }
      itemsByTenant[item.tenantId].push(item);
    }

    // Start a transaction if needed (Drizzle allows nested inserts or multiple, we'll do it sequentially for now)
    const createdOrderIds = [];

    for (const tenantId of Object.keys(itemsByTenant)) {
      const tId = parseInt(tenantId);
      const tenantItems = itemsByTenant[tId];
      
      // Fetch exact tenant details for accurate pickup location
      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tId));
      let exactPickupAddress = tenant?.address || pickupLocation || 'Business Location(s)';
      
      // Compute total for this tenant
      const totalAmount = tenantItems.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);

      // Create the deliveryOrder
      const [order] = await db.insert(deliveryOrders).values({
        tenantId: tId,
        customerId: customer.id, // Store the customers.id, not the users.id
        customerName: customer.name,
        customerContact: customer.mobileNumber,
        pickupAddress: exactPickupAddress,
        pickupLat: tenant?.lat || null,
        pickupLng: tenant?.lng || null,
        dropoffAddress: addressText || customer.address,
        dropoffLat: dropoffLat ? dropoffLat.toString() : null,
        dropoffLng: dropoffLng ? dropoffLng.toString() : null,
        instructions: dropoffLandmark || null,
        deliveryDate: deliveryDate ? new Date(deliveryDate) : null,
        status: 'DRAFT', // Or 'NEW' based on existing workflow
        deliveryPriority: deliveryPriority || 'STANDARD',
        orderSource: 'MARKETPLACE',
        urgentReason: urgentReason || null,
        normalDeliveryFee: normalDeliveryFee ? normalDeliveryFee.toString() : null,
        urgentAdditionalFee: urgentAdditionalFee ? urgentAdditionalFee.toString() : null,
      }).returning();

      // Create the deliveryItems
      const itemsToInsert = tenantItems.map(ti => ({
        deliveryOrderId: order.id,
        productId: ti.productId,
        variantId: ti.variantId,
        productName: ti.productName,
        quantity: ti.quantity,
        unitPrice: ti.price ? ti.price.toString() : '0',
        unit: ti.unit,
      }));
      
      await db.insert(deliveryItems).values(itemsToInsert);
      
      createdOrderIds.push(order.id);

      // --- QUOTA-BASED AGGREGATION LOGIC ---
      // For each variant ordered, check if the quota is met
      const uniqueVariantIds = Array.from(new Set(tenantItems.map(ti => ti.variantId)));
      for (const vId of uniqueVariantIds) {
        if (!vId) continue;
        
        // Find unbatched items for this variant
        const unbatchedResult = await db.execute(sql`
          SELECT di.id, di.delivery_order_id, di.quantity, dord.customer_id, pv.quota, pv.weight_per_piece_kg, dord.pickup_address
          FROM delivery_items di
          JOIN delivery_orders dord ON di.delivery_order_id = dord.id
          JOIN product_variants pv ON di.variant_id = pv.id
          WHERE di.variant_id = ${vId}
            AND dord.status != 'CANCELLED'
            AND NOT EXISTS (
              SELECT 1 FROM delivery_batch_items dbi
              JOIN delivery_batches dbatch ON dbi.batch_id = dbatch.id
              WHERE dbi.customer_order_id = di.delivery_order_id
                AND dbatch.variant_id = ${vId}
            )
          ORDER BY dord.created_at ASC
        `);

        if (unbatchedResult.length === 0) continue;

        const quota = Number((unbatchedResult[0] as any).quota || 50);
        const weightPerPieceKg = Number((unbatchedResult[0] as any).weight_per_piece_kg || 0);
        
        let totalQty = 0;
        let totalWeight = 0;
        const itemsToBatch = [];
        const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'TBD';

        for (const row of unbatchedResult as any[]) {
          const qty = Number(row.quantity);
          totalQty += qty;
          const cWeight = qty * weightPerPieceKg;
          totalWeight += cWeight;
          itemsToBatch.push({
            customerOrderId: row.delivery_order_id,
            customerId: row.customer_id,
            quantity: qty,
            customerWeight: cWeight.toFixed(2)
          });
        }

        // If quota is reached, create a delivery batch!
        if (totalQty >= quota) {
          const batchNum = 'DEL-' + Math.random().toString(36).substr(2, 6).toUpperCase();
          
          // Find recommended vehicle
          const [suggestedVehicle] = await db
            .select({ id: vehicles.id })
            .from(vehicles)
            .where(
              and(
                eq(vehicles.tenantId, tId),
                eq(vehicles.status, 'ACTIVE'),
                gte(vehicles.capacityKg, Math.ceil(totalWeight))
              )
            )
            .orderBy(asc(vehicles.capacityKg))
            .limit(1);

          const [newBatch] = await db.insert(deliveryBatches).values({
            tenantId: tId,
            batchNumber: batchNum,
            variantId: vId,
            totalQuantity: totalQty,
            quotaQuantity: quota,
            totalWeight: totalWeight.toString(),
            pickupLocation: pickupLoc,
            suggestedVehicleId: suggestedVehicle?.id || null,
            status: 'READY_FOR_DELIVERY'
          }).returning();

          await db.insert(deliveryBatchItems).values(
            itemsToBatch.map(ib => ({
              batchId: newBatch.id,
              customerOrderId: ib.customerOrderId,
              customerId: ib.customerId,
              quantity: ib.quantity,
              customerWeight: ib.customerWeight
            }))
          );

          // IMPORTANT: Update the actual deliveryOrders to set their batchId so they no longer appear as "waiting"
          const orderIdsToUpdate = itemsToBatch.map(ib => ib.customerOrderId);
          if (orderIdsToUpdate.length > 0) {
            await db.update(deliveryOrders)
              .set({ batchId: newBatch.id })
              .where(inArray(deliveryOrders.id, orderIdsToUpdate));
          }
        }
      }
      // -------------------------------------
    }

    // Clear only the checked-out items from cart that actually exist in the DB cart
    const processedCartItemIds = Object.values(itemsByTenant)
      .flat()
      .map((i: any) => i.cartItemId)
      .filter(id => id !== undefined && id !== null);
      
    if (processedCartItemIds.length > 0) {
      await db.delete(cartItems).where(inArray(cartItems.id, processedCartItemIds));
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Orders placed successfully',
      orderIds: createdOrderIds
    }, { status: 201 });

  } catch (error: any) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
