import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryBatches, deliveryBatchItems, productVariants, products, customers, deliveryOrders, deliveryItems, productSellingUnits, vehicles, deliveryAssignments, deliveryPartners } from '@/db/schema';
import { eq, desc, inArray, and, ne, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

import { purgeExpiredCompletedDeliveries } from '@/lib/delivery-purge';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    
    const isPlatformOwner = claims?.role === 'PLATFORM_OWNER';
    if (!claims || (!claims.tenantId && !isPlatformOwner)) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant ID' }, { status: 403 });
    }
    
    const { searchParams } = new URL(request.url);
    const headerTenantId = request.headers.get('x-tenant-id');
    const paramTenantId = searchParams.get('tenantId');
    let tenantIdToUse = claims.tenantId as number | null;
    if (isPlatformOwner) {
      if (headerTenantId) tenantIdToUse = parseInt(headerTenantId, 10);
      else if (paramTenantId) tenantIdToUse = parseInt(paramTenantId, 10);
    }

    // Automatically purge expired completed batches & orders older than 1 month, and cancelled older than 1 week
    await purgeExpiredCompletedDeliveries(tenantIdToUse).catch(err => {
      console.warn('Background purge error in marketplace route:', err);
    });

    const statusParam = searchParams.get('status');
    const limitParam = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Math.min(Math.max(1, limitParam), 1000);

    const conditions: any[] = [
      tenantIdToUse ? eq(deliveryBatches.tenantId, tenantIdToUse) : undefined,
    ];

    if (statusParam) {
      if (statusParam.includes(',')) {
        const statuses = statusParam.split(',').map(s => s.trim()).filter(Boolean);
        conditions.push(inArray(deliveryBatches.status, statuses));
      } else {
        conditions.push(eq(deliveryBatches.status, statusParam));
      }
    } else {
      conditions.push(ne(deliveryBatches.status, 'DRAFT'));
    }

    const whereClause = and(...conditions.filter(Boolean));

    // Fetch Completed Batches (Marketplace Deliveries)
    const batchesData = await db
      .select({
        id: deliveryBatches.id,
        tenantId: deliveryBatches.tenantId,
        batchNumber: deliveryBatches.batchNumber,
        totalQuantity: deliveryBatches.totalQuantity,
        quotaQuantity: deliveryBatches.quotaQuantity,
        totalWeight: deliveryBatches.totalWeight,
        pickupLocation: deliveryBatches.pickupLocation,
        status: deliveryBatches.status,
        createdAt: deliveryBatches.createdAt,
        variantName: productVariants.name,
        productName: products.name,
        variantPrice: productVariants.price,
        suggestedVehicleId: deliveryBatches.suggestedVehicleId,
        suggestedVehicleType: vehicles.vehicleType,
        suggestedVehiclePlate: vehicles.plateNumber,
        suggestedVehicleCapacity: vehicles.capacityKg,
      })
      .from(deliveryBatches)
      .leftJoin(productVariants, eq(deliveryBatches.variantId, productVariants.id))
      .leftJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(vehicles, eq(deliveryBatches.suggestedVehicleId, vehicles.id))
      .where(whereClause)
      .limit(limit)
      .orderBy(desc(deliveryBatches.createdAt));
      
    const batchIds = batchesData.map(b => b.id);
    let allBatchItems: any[] = [];
    let allDeliveryItems: any[] = [];
    let allAssignments: any[] = [];

    if (batchIds.length > 0) {
      allBatchItems = await db
        .select({
          id: deliveryBatchItems.id,
          batchId: deliveryBatchItems.batchId,
          customerOrderId: deliveryBatchItems.customerOrderId,
          quantity: deliveryBatchItems.quantity,
          customerWeight: deliveryBatchItems.customerWeight,
          customerName: customers.name,
          customerContact: customers.mobileNumber,
          dropoffAddress: deliveryOrders.dropoffAddress,
          partnerDriverName: deliveryOrders.partnerDriverName,
          partnerDriverContact: deliveryOrders.partnerDriverContact,
          temporaryWinnerId: deliveryOrders.temporaryWinnerId,
          preferredVehicle: deliveryOrders.preferredVehicle,
          finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
          offeredAmount: deliveryOrders.offeredAmount,
          normalDeliveryFee: deliveryOrders.normalDeliveryFee,
          urgentAdditionalFee: deliveryOrders.urgentAdditionalFee,
          deliveryPriority: deliveryOrders.deliveryPriority,
          deliveryDate: deliveryOrders.deliveryDate,
          orderStatus: deliveryOrders.status,
          routeDistance: deliveryOrders.routeDistance,
          distanceKm: deliveryOrders.distanceKm
        })
        .from(deliveryBatchItems)
        .leftJoin(customers, eq(deliveryBatchItems.customerId, customers.id))
        .leftJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
        .where(inArray(deliveryBatchItems.batchId, batchIds));

      const orderIds = Array.from(new Set(allBatchItems.map(i => i.customerOrderId).filter(id => id)));
      if (orderIds.length > 0) {
        [allDeliveryItems, allAssignments] = await Promise.all([
          db
            .select({
              itemId: deliveryItems.id,
              deliveryOrderId: deliveryItems.deliveryOrderId,
              productName: sql<string>`COALESCE(${deliveryItems.productName}, ${products.name})`.as('productName'),
              variantName: productVariants.name,
              quantity: deliveryItems.quantity,
              unitPrice: deliveryItems.unitPrice,
              unit: deliveryItems.unit,
            })
            .from(deliveryItems)
            .leftJoin(products, eq(deliveryItems.productId, products.id))
            .leftJoin(productVariants, eq(deliveryItems.variantId, productVariants.id))
            .where(inArray(deliveryItems.deliveryOrderId, orderIds)),
          db
            .select({
              deliveryOrderId: deliveryAssignments.deliveryOrderId,
              driverName: deliveryAssignments.driverName,
              vehicleDetails: deliveryAssignments.vehicleDetails,
              deliveryPartnerId: deliveryAssignments.deliveryPartnerId,
            })
            .from(deliveryAssignments)
            .where(inArray(deliveryAssignments.deliveryOrderId, orderIds))
        ]);
      }
    }

    // Look up delivery partner details for any partner assignments or winners
    const partnerIds = Array.from(new Set([
      ...allAssignments.map((a: any) => a.deliveryPartnerId).filter(Boolean),
      ...allBatchItems.map((i: any) => i.temporaryWinnerId).filter(Boolean)
    ]));

    const partnerMap = new Map();
    if (partnerIds.length > 0) {
      const partnerRows = await db
        .select({
          id: deliveryPartners.id,
          companyName: deliveryPartners.companyName,
          contactPerson: deliveryPartners.contactPerson,
          mobileNumber: deliveryPartners.mobileNumber
        })
        .from(deliveryPartners)
        .where(inArray(deliveryPartners.id, partnerIds));

      partnerRows.forEach((p: any) => {
        partnerMap.set(p.id, p);
      });
    }

    const enrichedBatches = batchesData.map(batch => {
      const items = allBatchItems.filter(item => item.batchId === batch.id).map(item => ({
        ...item,
        products: allDeliveryItems.filter(i => Number(i.deliveryOrderId) === Number(item.customerOrderId))
      }));

      // Find any assignment for orders in this batch
      const assignment = allAssignments.find((a: any) =>
        items.some(i => Number(i.customerOrderId) === Number(a.deliveryOrderId))
      );

      const partnerId = assignment?.deliveryPartnerId || items.find((i: any) => i.temporaryWinnerId)?.temporaryWinnerId || null;
      const partnerInfo = partnerId ? partnerMap.get(partnerId) : null;
      const partnerName = partnerInfo ? (partnerInfo.companyName || partnerInfo.contactPerson) : null;

      // Business owner's own fleet: only when internally assigned and NOT broadcast/partner
      const isOwnFleet = Boolean(
        assignment &&
        !assignment.deliveryPartnerId &&
        !partnerId &&
        batch.status !== 'WAITING_FOR_PARTNER' &&
        batch.status !== 'ACCEPTED'
      );

      // Partner fleet: if assigned to partner, accepted by partner, or broadcasted to partners
      const isPartner = Boolean(
        !isOwnFleet &&
        (partnerId || (assignment && assignment.deliveryPartnerId) || ['WAITING_FOR_PARTNER', 'ACCEPTED'].includes(batch.status) || items.some((i: any) => i.temporaryWinnerId || i.partnerDriverName || i.orderStatus === 'ACCEPTED' || i.orderStatus === 'WAITING_FOR_PARTNER'))
      );

      const fleetType = isOwnFleet ? 'OWN_FLEET' : (isPartner ? 'PARTNER_FLEET' : null);

      const driverName = assignment?.driverName
        || items.find((i: any) => i.partnerDriverName)?.partnerDriverName
        || (isPartner && partnerName ? `${partnerName}` : null);

      const vehicleDetails = assignment?.vehicleDetails 
        || (isOwnFleet && batch.suggestedVehiclePlate ? `${batch.suggestedVehiclePlate} - ${batch.suggestedVehicleType}` : null)
        || items.find((i: any) => i.preferredVehicle)?.preferredVehicle
        || (batch.suggestedVehiclePlate ? `${batch.suggestedVehiclePlate} - ${batch.suggestedVehicleType}` : batch.suggestedVehicleType)
        || null;

      const partnerContact = items.find((i: any) => i.partnerDriverContact)?.partnerDriverContact || partnerInfo?.mobileNumber || null;

      return {
        ...batch,
        items,
        driverName,
        vehicleDetails,
        fleetType,
        isOwnFleet,
        isPartner,
        partnerName,
        ownDriverName: isOwnFleet ? driverName : null,
        ownVehicleType: isOwnFleet ? vehicleDetails : null,
        partnerDriverName: isPartner ? driverName : null,
        partnerDriverContact: partnerContact,
      };
    });

    return NextResponse.json(enrichedBatches);
  } catch (error: any) {
    console.error('Error fetching marketplace batches:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
