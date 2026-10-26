import { NextResponse } from 'next/server';
import { db } from '@/db';
import { cartItems, deliveryOrders, deliveryItems, products, productVariants, customers, users, deliveryBatches, deliveryBatchItems, vehicles, tenants, notifications } from '@/db/schema';
import { eq, inArray, sql, and, gte, asc } from 'drizzle-orm';
import { calculateDeliveryQuote } from '@/lib/deliveryCalculation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerId, tenantId: checkoutTenantId, addressText, dropoffLat, dropoffLng, dropoffLandmark, deliveryPriority, urgentReason, pickupLocation, deliveryDate, normalDeliveryFee, urgentAdditionalFee, distanceKm, checkoutItems } = body;

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

    // Update customer address and default savedLocations if coordinates/address are provided
    if (addressText || dropoffLat || dropoffLng) {
      const finalAddress = addressText || customer.address || 'N/A';
      const latNum = dropoffLat ? Number(dropoffLat) : null;
      const lngNum = dropoffLng ? Number(dropoffLng) : null;

      let updatedSavedLocations = Array.isArray(customer.savedLocations) ? [...customer.savedLocations] : [];

      if (latNum !== null && lngNum !== null && !isNaN(latNum) && !isNaN(lngNum)) {
        const existingIndex = updatedSavedLocations.findIndex((l: any) =>
          (l.lat && Math.abs(Number(l.lat) - latNum) < 0.0001 && Math.abs(Number(l.lng) - lngNum) < 0.0001) ||
          (l.address && addressText && l.address.toLowerCase().trim() === addressText.toLowerCase().trim())
        );

        const newLoc = {
          id: existingIndex >= 0 ? (updatedSavedLocations[existingIndex].id || Date.now().toString()) : Date.now().toString(),
          locationName: dropoffLandmark ? dropoffLandmark : (addressText ? addressText.split(',')[0].trim() : 'Saved Address'),
          address: finalAddress,
          lat: latNum,
          lng: lngNum,
          landmark: dropoffLandmark || '',
          isDefault: true,
          updatedAt: new Date().toISOString()
        };

        updatedSavedLocations = updatedSavedLocations.map((l: any) => ({ ...l, isDefault: false }));
        if (existingIndex >= 0) {
          updatedSavedLocations[existingIndex] = { ...updatedSavedLocations[existingIndex], ...newLoc };
        } else {
          updatedSavedLocations.unshift(newLoc);
        }
      }

      await db.update(customers).set({
        address: finalAddress,
        savedLocations: updatedSavedLocations,
        updatedAt: new Date()
      }).where(eq(customers.id, customer.id));

      customer.address = finalAddress;
      customer.savedLocations = updatedSavedLocations;
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
          sellingUnitId: cartItems.sellingUnitId,
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

      // Find basis product (highest quantity)
      let basisProductId = null;
      let basisVariantId = null;
      let basisQuantity = 0;
      let hasBasisTie = false;

      const quantities = tenantItems.map(item => item.quantity);
      const maxQty = Math.max(...quantities, 0);

      const maxItems = tenantItems.filter(item => item.quantity === maxQty);
      if (maxItems.length > 0) {
        basisProductId = maxItems[0].productId;
        basisVariantId = maxItems[0].variantId;
        basisQuantity = maxItems[0].quantity;

        if (maxItems.length > 1) {
          hasBasisTie = true;
        }
      }

      // Authoritatively calculate quote, total quota, cargo weight, vehicle selection, and shipping fee
      const quote = await calculateDeliveryQuote({
        items: tenantItems.map(ti => ({
          productId: ti.productId,
          variantId: ti.variantId,
          sellingUnitId: ti.sellingUnitId || null,
          quantity: ti.quantity,
          unitPrice: ti.price ? Number(ti.price) : null,
        })),
        tenantId: tId,
        dropoffLat: dropoffLat ? Number(dropoffLat) : null,
        dropoffLng: dropoffLng ? Number(dropoffLng) : null,
        priority: deliveryPriority || 'STANDARD',
        customDistanceKm: distanceKm ? Number(distanceKm) : null,
      });

      if (!quote.success) {
        return NextResponse.json(
          { error: quote.error || 'Failed to determine vehicle or calculate delivery fee.' },
          { status: 422 }
        );
      }

      const totalAmount = quote.itemsSubtotal;

      // Verify that suggestedVehicleId corresponds to an actual physical row in vehicles table
      let validSuggestedVehicleId: number | null = null;
      const targetVehicleId = quote.vehicle?.physicalVehicleId ?? quote.vehicle?.id;
      if (targetVehicleId) {
        const [existingV] = await db
          .select({ id: vehicles.id })
          .from(vehicles)
          .where(eq(vehicles.id, targetVehicleId))
          .limit(1);
        if (existingV) {
          validSuggestedVehicleId = existingV.id;
        }
      }

      // Create the deliveryOrder with authoritative calculations
      const [order] = await db.insert(deliveryOrders).values({
        tenantId: tId,
        customerId: customer.id,
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
        status: 'DRAFT',
        deliveryPriority: deliveryPriority || 'STANDARD',
        orderSource: 'MARKETPLACE',
        urgentReason: urgentReason || null,
        totalWeight: quote.totalWeightKg.toString(),
        packedLengthCm: quote.packedDimensions.lengthCm.toString(),
        packedWidthCm: quote.packedDimensions.widthCm.toString(),
        packedHeightCm: quote.packedDimensions.heightCm.toString(),
        packageCategory: quote.packageCategory.code,
        shippingCalculationStatus: 'CALCULATED',
        shippingRateDetails: quote.shippingRateDetails || null,
        quota: quote.totalQuota,
        suggestedVehicleId: validSuggestedVehicleId,
        vehicleCapacityKg: quote.vehicle?.capacityKg || null,
        requiredVehicleType: quote.vehicle?.vehicleType || null,
        preferredVehicle: quote.vehicle?.vehicleType || null,
        vehicleBasePrice: '0', // Base fee strictly removed
        pricePerKm: quote.pricing ? quote.pricing.pricePerKm.toString() : null,
        normalDeliveryFee: quote.pricing ? quote.pricing.normalDeliveryFee.toString() : null,
        urgentAdditionalFee: quote.pricing ? quote.pricing.urgentFee.toString() : null,
        finalDeliveryPrice: quote.pricing ? quote.pricing.totalShippingFee.toString() : null,
        distanceKm: quote.distanceKm.toString(),
        routeDistance: `${quote.distanceKm.toFixed(2)} km`,
        offeredAmount: totalAmount.toString(),
        basisProductId: basisProductId,
        basisVariantId: basisVariantId,
        basisQuantity: basisQuantity,
        hasBasisTie: hasBasisTie
      }).returning();

      // Create the deliveryItems with saved weight and dimensions per item
      const itemsToInsert = tenantItems.map(ti => {
        const itemDetail = quote.itemBreakdown.find(
          ib => ib.productId === ti.productId && ib.variantId === ti.variantId
        );
        return {
          deliveryOrderId: order.id,
          productId: ti.productId,
          variantId: ti.variantId,
          productName: ti.productName,
          quantity: ti.quantity,
          unitPrice: ti.price ? ti.price.toString() : '0',
          unit: ti.unit,
          weightKg: itemDetail ? itemDetail.itemWeightKg.toString() : null,
          lengthCm: itemDetail ? itemDetail.lengthCm.toString() : null,
          widthCm: itemDetail ? itemDetail.widthCm.toString() : null,
          heightCm: itemDetail ? itemDetail.heightCm.toString() : null,
        };
      });

      await db.insert(deliveryItems).values(itemsToInsert);

      createdOrderIds.push(order.id);

      // Add notification for Business Owner
      await db.insert(notifications).values({
        tenantId: tId,
        deliveryOrderId: order.id,
        senderId: customer.id,
        receiverId: 0,
        receiverRole: 'BUSINESS_OWNER',
        notificationType: 'new_customer_order',
        title: 'New Customer Order',
        body: `A customer (${customer.name}) has placed a new order.`,
        actionUrl: `/admin/orders`,
        status: 'UNREAD'
      });

      // --- QUOTA-BASED AGGREGATION LOGIC (ONLY for Basis Product) ---
      // If there is a tie, we don't auto-batch. Wait for owner to resolve.
      if (!hasBasisTie && basisVariantId) {
        const vId = basisVariantId;

        // Find unbatched orders for this basis variant
        const unbatchedResult = await db.execute(sql`
          SELECT dord.id as delivery_order_id, dord.customer_id, dord.basis_quantity, pv.quota, pv.weight_per_piece_kg, pv.weight, p.weight_kg as product_weight, di.weight_kg as existing_item_weight, dord.pickup_address, psu.weight as selling_unit_weight, psu.weight_kg as selling_unit_weight_kg, psu.equivalent_qty
          FROM delivery_orders dord
          JOIN product_variants pv ON dord.basis_variant_id = pv.id
          JOIN products p ON pv.product_id = p.id
          LEFT JOIN delivery_items di ON di.delivery_order_id = dord.id AND di.variant_id = pv.id
          LEFT JOIN product_selling_units psu ON psu.product_id = di.product_id AND (psu.variant_id IS NULL OR psu.variant_id = pv.id) AND TRIM(psu.unit_name) ILIKE TRIM(di.unit)
          WHERE dord.basis_variant_id = ${vId}
            AND dord.has_basis_tie = false
            AND dord.status != 'CANCELLED'
            AND dord.batch_id IS NULL
          ORDER BY dord.created_at ASC
        `);

        if (unbatchedResult.length > 0) {
          const quota = Number((unbatchedResult[0] as any).quota || 50);

          let totalBasisQty = 0;
          let totalWeight = 0;
          const itemsToBatch = [];
          const pickupLoc = (unbatchedResult[0] as any).pickup_address || 'Main Store';

          // Use a set to prevent duplicate order processing due to LEFT JOINs
          const processedOrderIds = new Set();

          for (const row of unbatchedResult as any[]) {
            if (processedOrderIds.has(row.delivery_order_id)) continue;
            processedOrderIds.add(row.delivery_order_id);

            const qty = Number(row.basis_quantity) || 0;
            const equivMultiplier = Number(row.equivalent_qty) || 1;
            totalBasisQty += qty * equivMultiplier;

            const sellingUnitWeight = Number(row.selling_unit_weight_kg) || Number(row.selling_unit_weight) || 0;
            const pieceWeight = Number(row.weight_per_piece_kg) || Number(row.weight) || 0;
            const productWeight = Number(row.product_weight) || 0;

            let singleUnitWeight = 0;
            if (sellingUnitWeight > 0) {
              singleUnitWeight = sellingUnitWeight;
            } else if (pieceWeight > 0) {
              singleUnitWeight = pieceWeight * equivMultiplier;
            } else if (productWeight > 0) {
              singleUnitWeight = productWeight * equivMultiplier;
            } else if (Number(row.existing_item_weight) > 0) {
              singleUnitWeight = Number(row.existing_item_weight) / (qty || 1);
            }

            const cWeight = Math.round(qty * singleUnitWeight * 100) / 100;

            totalWeight += cWeight;
            itemsToBatch.push({
              customerOrderId: row.delivery_order_id,
              customerId: row.customer_id,
              quantity: qty * equivMultiplier,
              customerWeight: cWeight.toFixed(2)
            });
          }

          // If quota is reached, create a delivery batch!
          if (totalBasisQty >= quota) {
            const batchNum = 'DEL-' + Math.random().toString(36).substr(2, 6).toUpperCase();

            // Find recommended vehicle (check tenant fleet first, then any active vehicle)
            let [suggestedVehicle] = await db
              .select({ id: vehicles.id, vehicleType: vehicles.vehicleType, capacityKg: vehicles.capacityKg })
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

            if (!suggestedVehicle) {
              [suggestedVehicle] = await db
                .select({ id: vehicles.id, vehicleType: vehicles.vehicleType, capacityKg: vehicles.capacityKg })
                .from(vehicles)
                .where(
                  and(
                    eq(vehicles.status, 'ACTIVE'),
                    gte(vehicles.capacityKg, Math.ceil(totalWeight))
                  )
                )
                .orderBy(asc(vehicles.capacityKg))
                .limit(1);
            }

            const [newBatch] = await db.insert(deliveryBatches).values({
              tenantId: tId,
              batchNumber: batchNum,
              variantId: vId,
              totalQuantity: totalBasisQty,
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

            const orderIdsToUpdate = itemsToBatch.map(ib => ib.customerOrderId);
            if (orderIdsToUpdate.length > 0) {
              await db.update(deliveryOrders)
                .set({ batchId: newBatch.id })
                .where(inArray(deliveryOrders.id, orderIdsToUpdate));
            }
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
