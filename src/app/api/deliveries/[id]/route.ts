import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, products, productQuotas, quotaAccumulations, deliveryInvitations, deliveryAssignments, notifications, auditLogs } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { revertOrderStock } from '@/lib/inventory-helper';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const items = await tx
      .select()
      .from(deliveryItems)
      .where(eq(deliveryItems.deliveryOrderId, id));

    return NextResponse.json({ data: { ...order, items } });
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Must provide at least one item' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT orders can be updated' }, { status: 400 });

    const customerId = body.customerId !== undefined && body.customerId !== '' ? parseInt(body.customerId, 10) : null;
    const customerName = String(body.customerName || '').trim();
    const customerContact = String(body.customerContact || '').trim();
    const pickupAddress = String(body.pickupAddress || '').trim();
    const dropoffAddress = String(body.dropoffAddress || '').trim();
    const pickupLat = body.pickupLat !== undefined && body.pickupLat !== null && body.pickupLat !== '' ? parseFloat(body.pickupLat) : null;
    const pickupLng = body.pickupLng !== undefined && body.pickupLng !== null && body.pickupLng !== '' ? parseFloat(body.pickupLng) : null;
    const dropoffLat = body.dropoffLat !== undefined && body.dropoffLat !== null && body.dropoffLat !== '' ? parseFloat(body.dropoffLat) : null;
    const dropoffLng = body.dropoffLng !== undefined && body.dropoffLng !== null && body.dropoffLng !== '' ? parseFloat(body.dropoffLng) : null;
    const routeDistance = body.routeDistance !== undefined && body.routeDistance !== null && body.routeDistance !== '' ? String(body.routeDistance).trim() : null;
    const routeDuration = body.routeDuration !== undefined && body.routeDuration !== null && body.routeDuration !== '' ? String(body.routeDuration).trim() : null;
    const routePolyline = body.routePolyline !== undefined && body.routePolyline !== null && body.routePolyline !== '' ? String(body.routePolyline).trim() : null;
    const deliveryDate = body.deliveryDate ? new Date(body.deliveryDate) : null;
    const instructions = String(body.instructions || '').trim();
    const preferredVehicle = body.preferredVehicle !== undefined && body.preferredVehicle !== null && body.preferredVehicle !== '' ? String(body.preferredVehicle).trim() : null;

    if (!customerName || !pickupAddress || !dropoffAddress) {
      return NextResponse.json({ error: 'Missing required delivery information' }, { status: 400 });
    }

    await tx.update(deliveryOrders)
      .set({
        customerId,
        customerName,
        customerContact: customerContact || null,
        pickupAddress,
        dropoffAddress,
        pickupLat: pickupLat !== null ? String(pickupLat) : null,
        pickupLng: pickupLng !== null ? String(pickupLng) : null,
        dropoffLat: dropoffLat !== null ? String(dropoffLat) : null,
        dropoffLng: dropoffLng !== null ? String(dropoffLng) : null,
        routeDistance,
        routeDuration,
        routePolyline,
        deliveryDate,
        instructions: instructions || null,
        preferredVehicle,
      })
      .where(eq(deliveryOrders.id, order.id));

    const productIdsToFetch = items
      .map((item: any) => parseInt(item.productId, 10))
      .filter((id: number) => !isNaN(id));

    let productsStockMap = new Map<number, { name: string, stock: number }>();
    if (productIdsToFetch.length > 0) {
      const fetchedProducts = await tx
        .select({ id: products.id, name: products.name, stock: products.stock })
        .from(products)
        .where(and(
          inArray(products.id, productIdsToFetch),
          eq(products.tenantId, tenantIdToUse)
        ));

      fetchedProducts.forEach((p: any) => productsStockMap.set(p.id, { name: p.name, stock: p.stock }));
    }

    const requestedQuantities = new Map<number, number>();
    for (const item of items) {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);

      if (isNaN(productId) || isNaN(quantity) || quantity <= 0) {
        return NextResponse.json({ error: 'Invalid item data' }, { status: 400 });
      }

      requestedQuantities.set(productId, (requestedQuantities.get(productId) || 0) + quantity);
    }

    const insufficientProducts: string[] = [];
    for (const [productId, totalRequested] of requestedQuantities.entries()) {
      const productInfo = productsStockMap.get(productId);
      if (!productInfo || productInfo.stock < totalRequested) {
        insufficientProducts.push(productInfo ? productInfo.name : `ID ${productId}`);
      }
    }

    if (insufficientProducts.length > 0) {
      return NextResponse.json({ error: `Insufficient stock for: ${insufficientProducts.join(', ')}` }, { status: 400 });
    }

    const itemsToInsert = [];
    for (const item of items) {
      itemsToInsert.push({
        deliveryOrderId: order.id,
        productId: parseInt(item.productId, 10),
        quantity: parseInt(item.quantity, 10),
        unit: String(item.unit || '').trim(),
      });
    }

    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
    await tx.insert(deliveryItems).values(itemsToInsert).returning();

    const totalQuantity = itemsToInsert.reduce((sum, item) => sum + item.quantity, 0);
    await tx.update(deliveryOrders)
      .set({ currentOrdersCount: totalQuantity })
      .where(eq(deliveryOrders.id, order.id));

    return NextResponse.json({ data: { ...order, ...body, currentOrdersCount: totalQuantity } });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.delete'] }, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;

    let condition = eq(deliveryOrders.id, id);
    if (tenantIdToUse) {
      condition = and(condition, eq(deliveryOrders.tenantId, tenantIdToUse as number)) as any;
    }

    const [order] = await tx.select().from(deliveryOrders).where(condition);

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const isStockReversible = ['DISPATCHED', 'WAITING_APPROVAL', 'ASSIGNED', 'IN_TRANSIT'].includes(order.status);
    if (isStockReversible) {
      await revertOrderStock(tx, tenantIdToUse as number, order.id, claims.userId as number);
    }

    const oldAccumulations = await tx.select().from(quotaAccumulations).where(eq(quotaAccumulations.sourceOrderId, order.id));
    for (const accum of oldAccumulations) {
      const [quota] = await tx.select().from(productQuotas).where(eq(productQuotas.productId, accum.productId));
      if (quota) {
        const newAccumulated = Math.max(0, quota.accumulatedQuantity - accum.quantityAdded);
        const newStatus = newAccumulated >= quota.targetQuantity ? 'REACHED' : 'IN_PROGRESS';
        await tx.update(productQuotas).set({ accumulatedQuantity: newAccumulated, status: newStatus }).where(eq(productQuotas.id, quota.id));
      }
    }

    await tx.delete(quotaAccumulations).where(eq(quotaAccumulations.sourceOrderId, order.id));
    await tx.delete(deliveryAssignments).where(eq(deliveryAssignments.deliveryOrderId, order.id));
    await tx.delete(deliveryInvitations).where(eq(deliveryInvitations.deliveryOrderId, order.id));
    await tx.delete(notifications).where(eq(notifications.deliveryOrderId, order.id));
    await tx.delete(auditLogs).where(and(eq(auditLogs.entityType, 'DELIVERY_ORDER'), eq(auditLogs.entityId, order.id)));
    await tx.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
    await tx.delete(deliveryOrders).where(condition);

    return NextResponse.json({ success: true, message: 'Order and related data deleted successfully' });
  });
}
