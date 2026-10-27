import { NextResponse } from 'next/server';
import { deliveryOrders, deliveryItems, products, productVariants, productQuotas, quotaAccumulations, deliveryPartners, users, deliveryAssignments } from '@/db/schema';
import { eq, desc, and, inArray, sql as drizzleSql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { purgeExpiredDeliveries } from '@/lib/delivery-purge';

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

    const tenantParam = searchParams.get('tenantId');
    const headerTenant = request.headers.get('x-tenant-id');
    const explicitTenant = tenantParam ? parseInt(tenantParam, 10) : (headerTenant ? parseInt(headerTenant, 10) : null);
    if (!tenantIdToUse && explicitTenant) {
      tenantIdToUse = explicitTenant;
    }

    // Automatically purge completed deliveries older than 1 month, and cancelled older than 1 week
    await purgeExpiredDeliveries(tenantIdToUse).catch(err => {
      console.warn('Background purge error in deliveries route:', err);
    });

    const conditions: any[] = [
      eq(deliveryOrders.orderSource, 'CREATED')
    ];
    if (tenantIdToUse) {
      conditions.push(eq(deliveryOrders.tenantId, tenantIdToUse));
    }
    if (statusFilter) {
      if (statusFilter.includes(',')) {
        const statuses = statusFilter.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(inArray(deliveryOrders.status, statuses));
      } else {
        conditions.push(eq(deliveryOrders.status, statusFilter));
      }
    }

    const whereClause = and(...conditions);

    // RLS will enforce tenant isolation automatically
    // 1. Fetch orders and total count in PARALLEL
    const [data, countRows] = await Promise.all([
      tx
        .select({
          id: deliveryOrders.id,
          tenantId: deliveryOrders.tenantId,
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
          partnerDriverName: deliveryOrders.partnerDriverName,
          partnerDriverContact: deliveryOrders.partnerDriverContact,
          deliveryDate: deliveryOrders.deliveryDate,
          currentOrdersCount: deliveryOrders.currentOrdersCount,
          createdAt: deliveryOrders.createdAt,
        })
        .from(deliveryOrders)
        .where(whereClause)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(deliveryOrders.createdAt)),
      tx
        .select({ total: drizzleSql<number>`count(*)::int` })
        .from(deliveryOrders)
        .where(whereClause)
    ]);

    const total = countRows[0]?.total || 0;

    // 2. Fetch products, quotas, and assignments in PARALLEL
    const orderIds = data.map((o: any) => o.id);
    if (orderIds.length > 0) {
      const winnerIds = data.map((o: any) => o.temporaryWinnerId).filter(Boolean);

      const [winners, items, accumulations, assignments] = await Promise.all([
        winnerIds.length > 0
          ? tx
              .select({
                id: deliveryPartners.id,
                companyName: deliveryPartners.companyName,
                contactPerson: deliveryPartners.contactPerson,
                mobileNumber: deliveryPartners.mobileNumber,
                email: deliveryPartners.email,
              })
              .from(deliveryPartners)
              .where(inArray(deliveryPartners.id, winnerIds))
          : Promise.resolve([]),
        tx
          .select({
            itemId: deliveryItems.id,
            deliveryOrderId: deliveryItems.deliveryOrderId,
            productId: products.id,
            productName: products.name,
            variantName: productVariants.name,
            unit: deliveryItems.unit,
            quantity: deliveryItems.quantity,
            unitPrice: productVariants.price
          })
          .from(deliveryItems)
          .innerJoin(products, eq(deliveryItems.productId, products.id))
          .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
          .where(inArray(deliveryItems.deliveryOrderId, orderIds)),
        tx
          .select({
            deliveryOrderId: quotaAccumulations.sourceOrderId,
            itemId: quotaAccumulations.sourceItemId,
            quantityAdded: quotaAccumulations.quantityAdded,
          })
          .from(quotaAccumulations)
          .where(inArray(quotaAccumulations.sourceOrderId, orderIds)),
        tx
          .select({
            deliveryOrderId: deliveryAssignments.deliveryOrderId,
            driverName: deliveryAssignments.driverName,
            vehicleDetails: deliveryAssignments.vehicleDetails,
          })
          .from(deliveryAssignments)
          .where(inArray(deliveryAssignments.deliveryOrderId, orderIds))
      ]);

      const winnerMap = new Map<number, any>();
      winners.forEach((winner: any) => winnerMap.set(winner.id, winner));

      const accMap: Record<string, number> = {};
      for (const acc of accumulations) {
        const key = `${acc.deliveryOrderId}-${acc.itemId}`;
        accMap[key] = (accMap[key] || 0) + acc.quantityAdded;
      }

      const assignmentMap = new Map();
      assignments.forEach((a: any) => assignmentMap.set(a.deliveryOrderId, a));

      data.forEach((order: any) => {
        order.products = items
          .filter((i: any) => i.deliveryOrderId === order.id)
          .map((i: any) => {
            const accQty = accMap[`${order.id}-${i.itemId}`] || 0;
            return {
              ...i,
              accumulatedQuantity: accQty,
              targetQuantity: order.quota,
              quotaStatus: accQty >= order.quota ? 'REACHED' : 'IN_PROGRESS'
            };
          });

        if (order.temporaryWinnerId) {
          order.temporaryWinner = winnerMap.get(order.temporaryWinnerId) || null;
        } else {
          order.temporaryWinner = null;
        }

        const assignment = assignmentMap.get(order.id);
        if (assignment && !order.temporaryWinnerId) {
          order.internalAssignment = assignment;
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
    const quota = body.quota !== undefined && body.quota !== null ? Number(body.quota) : 10;
    const orderSource = body.orderSource ? String(body.orderSource) : 'CREATED';

    // Vehicle pricing fields — set at creation from Platform Owner rates
    const requiredVehicleType = body.requiredVehicleType !== undefined && body.requiredVehicleType !== null && body.requiredVehicleType !== '' ? String(body.requiredVehicleType).trim() : null;
    const vehicleBasePrice = body.vehicleBasePrice !== undefined && body.vehicleBasePrice !== null && body.vehicleBasePrice !== '' ? String(Number(body.vehicleBasePrice)) : null;
    const vehiclePricePerKm = body.pricePerKm !== undefined && body.pricePerKm !== null && body.pricePerKm !== '' ? String(Number(body.pricePerKm)) : null;
    const distanceKm = body.distanceKm !== undefined && body.distanceKm !== null && body.distanceKm !== '' ? String(Number(body.distanceKm)) : null;
    const finalDeliveryPrice = (vehicleBasePrice && vehiclePricePerKm && distanceKm)
      ? String(Number(vehicleBasePrice) + Number(distanceKm) * Number(vehiclePricePerKm))
      : null;

    if (!customerName || !pickupAddress || !dropoffAddress || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Missing required delivery information' }, { status: 400 });
    }

    if (!claims.tenantId && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const normalizedItems = items.map((item: any) => {
      const productId = parseInt(item.productId, 10);
      const quantity = parseInt(item.quantity, 10);
      if (Number.isNaN(productId) || Number.isNaN(quantity) || quantity < 0) {
        throw new Error('Invalid item data');
      }
      return {
        productId,
        quantity,
        unit: String(item.unit || '').trim() || 'pcs',
        variantId: item.variantId ? parseInt(item.variantId, 10) : undefined,
      };
    });

    let rawTenantId = claims.tenantId;
    if (claims.role === 'PLATFORM_OWNER') {
      if (body.tenantId !== undefined && body.tenantId !== null && body.tenantId !== '') {
        rawTenantId = parseInt(body.tenantId, 10);
      } else if (normalizedItems.length > 0 && normalizedItems[0].productId) {
        const [prod] = await tx
          .select({ tenantId: products.tenantId })
          .from(products)
          .where(eq(products.id, normalizedItems[0].productId));
        if (prod?.tenantId) {
          rawTenantId = prod.tenantId;
        }
      }
    }

    if (!rawTenantId || Number.isNaN(rawTenantId)) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const tenantIdToUse = Number(rawTenantId);
    const totalQuantity = items.reduce((sum: number, item: any) => sum + (parseInt(item.quantity, 10) || 0), 0);

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
      requiredVehicleType,
      vehicleBasePrice: vehicleBasePrice ?? undefined,
      pricePerKm: vehiclePricePerKm ?? undefined,
      distanceKm: distanceKm ?? undefined,
      finalDeliveryPrice: finalDeliveryPrice ?? undefined,
      pricingFrozenAt: requiredVehicleType ? new Date() : undefined,
      status: 'DRAFT',
      orderSource,
      quota,
      currentOrdersCount: totalQuantity,
      offeredAmount: items.reduce((sum: number, it: any) => sum + (Number(it.quantity) * Number(it.price || 0)), 0).toString(),
    }).returning();

    const productIdsToFetch = normalizedItems.map((item) => item.productId);
    const productsStockMap = new Map<number, { name: string; stock: number; price: number }>();
    if (productIdsToFetch.length > 0) {
      const fetchedProducts = await tx
        .select({ id: products.id, name: products.name, stock: productVariants.stock, price: productVariants.price })
        .from(products)
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
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
        productName: productInfo.name,
        unitPrice: unitPrice.toString(),
        quantity: item.quantity,
        unit: item.unit,
        variantId: item.variantId,
      });
    }

    await tx.update(deliveryOrders).set({ offeredAmount: orderTotal.toString() }).where(eq(deliveryOrders.id, order.id));
    const insertedItems = await tx.insert(deliveryItems).values(itemsToInsert).returning();

    return NextResponse.json({ data: { ...order, items: insertedItems } }, { status: 201 });
  });
}
