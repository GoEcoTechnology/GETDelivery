import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-helper';
import { vehicles } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (!claims.tenantId && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const companyVehicles = await tx
      .select({
        id: vehicles.id,
        plateNumber: vehicles.plateNumber,
        vehicleType: vehicles.vehicleType,
      })
      .from(vehicles)
      .where(and(
        eq(vehicles.tenantId, tenantIdToUse),
        eq(vehicles.status, 'ACTIVE'),
        isNull(vehicles.deliveryPartnerId)
      ));

    return NextResponse.json({ data: companyVehicles });
  });
}
