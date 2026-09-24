import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, customers, productVariants, quotaAccumulations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.create'] }, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const quantity = parseInt(body.quantity, 10);

    if (isNaN(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 });
    }

    const tenantIdToUse = claims.tenantId as number;

    // 1. Find the master order (the one managing the quota)
    const [masterOrder] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!masterOrder) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const remaining = masterOrder.quota - masterOrder.currentOrdersCount;
    if (quantity > remaining) {
      return NextResponse.json({
        error: `Cannot add ${quantity} orders. Remaining capacity is only ${remaining}.`
      }, { status: 400 });
    }

    // 2. If full customer payload is provided, create a sub-order
    const customerName = String(body.customerName || '').trim();
    const contactNumber = String(body.contactNumber || '').trim();
    const address = String(body.address || '').trim();
    const landmark = String(body.landmark || '').trim();
    const lat = body.lat != null ? parseFloat(body.lat) : null;
    const lng = body.lng != null ? parseFloat(body.lng) : null;
    const productId = body.productId ? parseInt(body.productId, 10) : null;
    const variantId = body.variantId ? parseInt(body.variantId, 10) : null;
    const unit = String(body.unit || 'pcs').trim();

    if (customerName) {
      if (!contactNumber || !address) {
        return NextResponse.json({ error: 'Contact number and address are required' }, { status: 400 });
      }
      if (!productId || isNaN(productId)) {
        return NextResponse.json({ error: 'Product is required' }, { status: 400 });
      }

      // Upsert customer record (match by phone + tenant)
      let customerId: number | null = null;
      const existing = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.tenantId, tenantIdToUse), eq(customers.mobileNumber, contactNumber)))
        .limit(1);

      if (existing.length > 0) {
        customerId = existing[0].id;
      } else {
        const [newCust] = await tx.insert(customers).values({
          tenantId: tenantIdToUse,
          name: customerName,
          mobileNumber: contactNumber,
          address: address,
        }).returning({ id: customers.id });
        customerId = newCust.id;
      }

      // Fetch variant price
      let unitPrice: string | null = null;
      if (variantId) {
        const [variant] = await tx
          .select({ price: productVariants.price })
          .from(productVariants)
          .where(eq(productVariants.id, variantId));
        if (variant?.price) unitPrice = String(variant.price);
      }

      // Create sub delivery order per customer
      const [subOrder] = await tx.insert(deliveryOrders).values({
        tenantId: tenantIdToUse,
        parentOrderId: id,
        customerId,
        customerName,
        customerContact: contactNumber,
        pickupAddress: masterOrder.pickupAddress,
        pickupLat: masterOrder.pickupLat ?? undefined,
        pickupLng: masterOrder.pickupLng ?? undefined,
        dropoffAddress: landmark ? `${address} (${landmark})` : address,
        dropoffLat: lat != null ? String(lat) : undefined,
        dropoffLng: lng != null ? String(lng) : undefined,
        instructions: landmark || undefined,
        status: 'DRAFT',
        orderSource: 'SUB_ORDER',
        quota: masterOrder.quota,
        currentOrdersCount: quantity,
        offeredAmount: unitPrice ? String(parseFloat(unitPrice) * quantity) : '0',
      }).returning();

      // Insert delivery item for the sub order
      await tx.insert(deliveryItems).values({
        deliveryOrderId: subOrder.id,
        productId,
        variantId: variantId ?? undefined,
        quantity,
        unit,
        unitPrice: unitPrice ?? undefined,
      });
    }

    // 3. Increment master order count
    const newCount = masterOrder.currentOrdersCount + quantity;
    const isAutoReady = newCount >= masterOrder.quota && masterOrder.status === 'DRAFT';

    const [updated] = await tx
      .update(deliveryOrders)
      .set({ 
        currentOrdersCount: newCount,
        ...(isAutoReady ? { status: 'READY_FOR_DISPATCH' } : {})
      })
      .where(eq(deliveryOrders.id, id))
      .returning();

    // 4. Update accumulated quantity per product
    const itemId = body.itemId ? parseInt(body.itemId, 10) : null;
    if (itemId && productId) {
      await tx.insert(quotaAccumulations).values({
        tenantId: tenantIdToUse,
        productId,
        sourceOrderId: id,
        sourceItemId: itemId,
        quantityAdded: quantity,
      });
    }

    return NextResponse.json({
      success: true,
      addedCount: quantity,
      currentOrdersCount: updated.currentOrdersCount,
      remainingCapacity: updated.quota - updated.currentOrdersCount
    });
  });
}
