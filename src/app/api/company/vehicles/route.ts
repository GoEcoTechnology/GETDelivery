import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-helper';
import { vehicles, deliveryBatches, deliveryOrders, deliveryAssignments } from '@/db/schema';
import { eq, and, isNull, inArray, ne, sql } from 'drizzle-orm';
import { determineVehicleForBatch, determineVehicleForDelivery, getActiveVehiclesList } from '@/lib/deliveryCalculation';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (!claims.tenantId && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const headerTenantId = request.headers.get('x-tenant-id');
    const paramTenantId = searchParams.get('tenantId');
    const batchId = searchParams.get('batchId');
    const deliveryId = searchParams.get('deliveryId');

    let tenantIdToUse: number | null = claims.tenantId as number | null;

    if (claims.role === 'PLATFORM_OWNER') {
      if (headerTenantId) {
        tenantIdToUse = parseInt(headerTenantId, 10);
      } else if (paramTenantId) {
        tenantIdToUse = parseInt(paramTenantId, 10);
      } else if (batchId) {
        const [b] = await tx.select({ tenantId: deliveryBatches.tenantId }).from(deliveryBatches).where(eq(deliveryBatches.id, parseInt(batchId, 10)));
        if (b) tenantIdToUse = b.tenantId;
      } else if (deliveryId) {
        const [d] = await tx.select({ tenantId: deliveryOrders.tenantId }).from(deliveryOrders).where(eq(deliveryOrders.id, parseInt(deliveryId, 10)));
        if (d) tenantIdToUse = d.tenantId;
      }
    }

    // 1. Fetch active company vehicle assignments in progress
    const [allActiveVehicles, vehicleFitResult, activeAssignments, activeBatches] = await Promise.all([
      getActiveVehiclesList(),
      batchId
        ? determineVehicleForBatch(parseInt(batchId, 10), tenantIdToUse)
        : deliveryId
          ? determineVehicleForDelivery(parseInt(deliveryId, 10), tenantIdToUse)
          : Promise.resolve(null),
      tx
        .select({
          vehicleDetails: deliveryAssignments.vehicleDetails,
        })
        .from(deliveryAssignments)
        .leftJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
        .where(
          and(
            isNull(deliveryAssignments.deliveryPartnerId),
            inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
            inArray(deliveryOrders.status, ['DISPATCHED', 'IN_TRANSIT', 'ACCEPTED', 'ASSIGNED'])
          )
        ),
      tx
        .select({
          suggestedVehicleId: deliveryBatches.suggestedVehicleId,
        })
        .from(deliveryBatches)
        .where(
          and(
            inArray(deliveryBatches.status, ['DISPATCHED', 'IN_TRANSIT', 'ACCEPTED']),
            sql`${deliveryBatches.suggestedVehicleId} IS NOT NULL`,
            batchId ? ne(deliveryBatches.id, parseInt(batchId, 10)) : undefined
          )
        )
    ]);

    const busyPlates = new Set(
      activeAssignments
        .map((a: any) => a.vehicleDetails?.split(' - ')[0]?.trim())
        .filter(Boolean)
    );
    const busyVehicleIds = new Set(
      activeBatches.map((b: any) => b.suggestedVehicleId).filter(Boolean)
    );

    const companyVehicles = allActiveVehicles
      .filter((v: any) => {
        if (v.status === 'ARCHIVED') return false;
        if (v.deliveryPartnerId) return false;
        if (tenantIdToUse && v.tenantId !== tenantIdToUse) return false;
        return true;
      })
      .map((v: any) => {
        const isBusy = v.status === 'NOT AVAILABLE' || busyPlates.has(v.plateNumber?.trim()) || busyVehicleIds.has(v.id);
        return {
          id: v.id,
          plateNumber: v.plateNumber,
          vehicleType: v.vehicleType,
          capacityKg: v.capacityKg,
          cargoLengthCm: v.cargoLengthCm,
          cargoWidthCm: v.cargoWidthCm,
          cargoHeightCm: v.cargoHeightCm,
          status: isBusy ? 'NOT AVAILABLE' : v.status,
          isBusy,
        };
      });

    // Check if suggested vehicle is busy, and if so select an available alternative
    let finalSuggestedId = vehicleFitResult?.bestVehicle?.id || null;
    let finalSuggestedVehicle = vehicleFitResult?.bestVehicle || null;

    if (finalSuggestedId && (busyVehicleIds.has(finalSuggestedId) || busyPlates.has(finalSuggestedVehicle?.plateNumber?.trim()))) {
      const alt = companyVehicles.find((v: any) => !v.isBusy && Number(v.capacityKg) >= Number(vehicleFitResult?.totalWeight || 0));
      if (alt) {
        finalSuggestedId = alt.id;
        finalSuggestedVehicle = alt;
      }
    }

    return NextResponse.json({
      data: companyVehicles,
      suggestedVehicleId: finalSuggestedId,
      suggestedVehicle: finalSuggestedVehicle,
      cargoSummary: vehicleFitResult ? {
        totalWeight: vehicleFitResult.totalWeight,
        totalItems: vehicleFitResult.totalItems,
        items: vehicleFitResult.packingItems
      } : null,
      evaluations: vehicleFitResult?.evaluatedVehicles || []
    });
  });
}
