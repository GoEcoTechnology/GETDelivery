import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-helper';
import { drivers, deliveryBatches, deliveryOrders, deliveryAssignments } from '@/db/schema';
import { eq, and, isNull, inArray, ne } from 'drizzle-orm';

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

    // 1. Fetch active company drivers
    const allDrivers = await tx
      .select({
        id: drivers.id,
        name: drivers.name,
        mobile: drivers.mobile,
        tenantId: drivers.tenantId,
        deliveryPartnerId: drivers.deliveryPartnerId,
        status: drivers.status,
      })
      .from(drivers)
      .where(and(
        ne(drivers.status, 'ARCHIVED'),
        isNull(drivers.deliveryPartnerId),
        tenantIdToUse ? eq(drivers.tenantId, tenantIdToUse) : undefined
      ));

    // 2. Fetch driver names currently assigned to active deliveries
    const activeAssignments = await tx
      .select({
        driverName: deliveryAssignments.driverName,
      })
      .from(deliveryAssignments)
      .leftJoin(deliveryOrders, eq(deliveryAssignments.deliveryOrderId, deliveryOrders.id))
      .where(
        and(
          isNull(deliveryAssignments.deliveryPartnerId),
          inArray(deliveryAssignments.status, ['ASSIGNED', 'IN_TRANSIT']),
          inArray(deliveryOrders.status, ['DISPATCHED', 'IN_TRANSIT', 'ACCEPTED', 'ASSIGNED'])
        )
      );

    const busyDriverNames = new Set(activeAssignments.map((a: any) => a.driverName?.trim()).filter(Boolean));

    const companyDrivers = allDrivers.map((d: any) => {
      const isBusy = d.status === 'NOT AVAILABLE' || busyDriverNames.has(d.name?.trim());
      return {
        id: d.id,
        name: d.name,
        mobile: d.mobile,
        status: isBusy ? 'NOT AVAILABLE' : d.status,
        isBusy,
      };
    });

    return NextResponse.json({ data: companyDrivers });
  });
}
