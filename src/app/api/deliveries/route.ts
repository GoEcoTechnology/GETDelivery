import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, products, productQuotas, quotaAccumulations, deliveryPartners, users } from '@/db/schema';
import { eq, desc, and, inArray, sql as drizzleSql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '6', 10);
    const statusFilter = searchParams.get('status');
    const offset = (page - 1) * limit;
    let tenantIdToUse = claims.tenantId as number | null;

    if (!tenantIdToUse && typeof claims.userId === 'number' && claims.role !== 'PLATFORM_OWNER') {
      const [userRow] = await tx
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, claims.userId));
      tenantIdToUse = userRow?.tenantId ?? null;
    }

    if (!tenantIdToUse && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    let whereClause = eq(deliveryOrders.tenantId, tenantIdToUse as number);
    if (statusFilter) {
      whereClause = and(whereClause, eq(deliveryOrders.status, statusFilter)) as any;
    }

    // RLS will enforce tenant isolation automatically
    const data = await tx
      .select({
        id: deliveryOrders.id,
        offeredAmount: deliveryOrders.offeredAmount,
        customerName: deliveryOrders.customerName,
        customerContact: deliveryOrders.customerContact,
        pickupAddress: deliveryOrders.pickupAddress,
        dropoffAddress: deliveryOrders.dropoffAddress,
        preferredVehicle: deliveryOrders.preferredVehicle,
        requiredVehicleType: deliveryOrders.requiredVehicleType,
        vehicleBasePrice: deliveryOrders.vehicleBasePrice,
        pricePerKm: deliveryOrders.pricePerKm,
        distanceKm: deliveryOrders.distanceKm,
        finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
        status: deliveryOrders.status,
        batchId: deliveryOrders.batchId,
        quota: deliveryOrders.quota,
        temporaryWinnerId: deliveryOrders.temporaryWinnerId,
        currentOrdersCount: drizzleSql<number>`COALESCE((SELECT SUM(quantity) FROM delivery_items WHERE delivery_order_id = ${deliveryOrders.id}), 0)::int`,
        createdAt: deliveryOrders.createdAt,
      })
      .from(deliveryOrders)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(deliveryOrders.createdAt));

    // Also get total count for pagination
    const [{ total }] = await tx
      .select({ total: drizzleSql<number>`count(*)::int` })
      .from(deliveryOrders)
      .where(whereClause);

    // Fetch products and quotas for these orders
    const orderIds = data.map((o: any) => o.id);
    if (orderIds.length > 0) {
      const winners = await tx
        .select({
          id: deliveryPartners.id,
          companyName: deliveryPartners.companyName,
          contactPerson: deliveryPartners.contactPerson,
          mobileNumber: deliveryPartners.mobileNumber,
          email: deliveryPartners.email,
        })
        .from(deliveryPartners)
        .where(inArray(deliveryPartners.id, data.map((o: any) => o.temporaryWinnerId).filter(Boolean)));

      const winnerMap = new Map<number, {
        id: number;
        companyName: string | null;
        contactPerson: string | null;
        mobileNumber: string | null;
        email: string | null;
      }>();
      winners.forEach((winner: {
        id: number;
        companyName: string | null;
        contactPerson: string | null;
        mobileNumber: string | null;
        email: string | null;
      }) => winnerMap.set(winner.id, winner));

      const items = await tx
        .select({
          deliveryOrderId: deliveryItems.deliveryOrderId,
          productId: products.id,
          productName: products.name,
          quantity: deliveryItems.quantity,
          unitPrice: products.price
        })
        .from(deliveryItems)
        .innerJoin(products, eq(deliveryItems.productId, products.id))
        .where(inArray(deliveryItems.deliveryOrderId, orderIds));

      const accumulations = await tx
        .select({
          deliveryOrderId: quotaAccumulations.sourceOrderId,
          productId: quotaAccumulations.productId,
          quantityAdded: quotaAccumulations.quantityAdded,
        })
        .from(quotaAccumulations)
        .where(inArray(quotaAccumulations.sourceOrderId, orderIds));
      
      const accMap: Record<string, number> = {};
      for (const acc of accumulations) {
        const key = `${acc.deliveryOrderId}-${acc.productId}`;
        accMap[key] = (accMap[key] || 0) + acc.quantityAdded;
      }

      data.forEach((order: any) => {
        order.products = items
          .filter((i: any) => i.deliveryOrderId === order.id)
          .map((i: any) => {
            const accQty = accMap[`${order.id}-${i.productId}`] || 0;
            return {
              ...i,
              accumulatedQuantity: accQty,
              targetQuantity: i.quantity,
              quotaStatus: accQty >= i.quantity ? 'REACHED' : 'IN_PROGRESS'
            };
          });

        if (order.temporaryWinnerId) {
          order.temporaryWinner = winnerMap.get(order.temporaryWinnerId) || null;
        } else {
          order.temporaryWinner = null;
        }
      });
    }

    return NextResponse.json({ data, page, limit, totalCount: total });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.create'] }, async (tx, claims) => {
    const body = await request.json();
    const items = Array.isArray(body.items) ? body.items : [];

    const rawCustomerId = body.customerId;
    const customerId = rawCustomerId === undefined || rawCustomerId === null || String(rawCustomerId).trim() === ''
      ? null
      : Number.isFinite(Number(rawCustomerId))
        ? Number.parseInt(String(rawCustomerId), 10)
        : null;
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

    if (!customerName || !pickupAddress || !dropoffAddress || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required delivery information' }, { status: 400 });
    }

    if (!claims.tenantId && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const rawTenantId = claims.role === 'PLATFORM_OWNER' && body.tenantId !== undefined && body.tenantId !== null && body.tenantId !== ''
      ? parseInt(body.tenantId, 10)
      : claims.tenantId;

    if (!rawTenantId || Number.isNaN(rawTenantId)) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const tenantIdToUse = Number(rawTenantId);
    const totalQuantity = items.reduce((sum: number, item: any) => sum + (parseInt(item.quantity, 10) || 0), 0);

    const normalizedItems = items.map((item: any) => {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);
      if (Number.isNaN(productId) || Number.isNaN(quantity) || quantity <= 0) {
        throw new Error('Invalid item data');
      }
      return {
        productId,
        quantity,
        unit: String(item.unit || '').trim() || 'pcs',
      };
    });

    const [order] = await tx.insert(deliveryOrders).values({
      tenantId: tenantIdToUse,
      customerId,
      customerName,
      customerContact: customerContact || null,
      pickupAddress,
      dropoffAddress,
      pickupLat: pickupLat !== null ? String(pickupLat) : undefined,
      pickupLng: pickupLng !== null ? String(pickupLng) : undefined,
      dropoffLat: dropoffLat !== null ? String(dropoffLat) : undefined,
      dropoffLng: dropoffLng !== null ? String(dropoffLng) : undefined,
      routeDistance,
      routeDuration,
      routePolyline,
      deliveryDate,
      instructions: instructions || null,
      preferredVehicle,
      status: 'DRAFT',
      currentOrdersCount: totalQuantity,
    }).returning();

    const productIdsToFetch = normalizedItems.map((item) => item.productId);
    const productsStockMap = new Map<number, { name: string; stock: number; price: number }>();
    if (productIdsToFetch.length > 0) {
      const fetchedProducts = await tx
        .select({ id: products.id, name: products.name, stock: products.stock, price: products.price })
        .from(products)
        .where(inArray(products.id, productIdsToFetch));

      fetchedProducts.forEach((p: any) => {
        productsStockMap.set(p.id, {
          name: p.name,
          stock: Number(p.stock ?? 0),
          price: Number.parseFloat(String(p.price ?? 0)) || 0,
        });
      });
    }

    const requestedQuantities = new Map<number, number>();
    for (const item of normalizedItems) {
      requestedQuantities.set(item.productId, (requestedQuantities.get(item.productId) || 0) + item.quantity);
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
    let orderTotal = 0;
    for (const item of normalizedItems) {
      const productInfo = productsStockMap.get(item.productId) || { name: '', stock: 0, price: 0 };
      const unitPrice = Number.parseFloat(String(productInfo.price)) || 0;
      orderTotal += unitPrice * item.quantity;
      itemsToInsert.push({
        deliveryOrderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unit: item.unit,
      });
    }

    await tx.update(deliveryOrders).set({ offeredAmount: orderTotal.toString() }).where(eq(deliveryOrders.id, order.id));
    const insertedItems = await tx.insert(deliveryItems).values(itemsToInsert).returning();

    return NextResponse.json({ data: { ...order, items: insertedItems } }, { status: 201 });
  });
}
