import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-helper';
import { drivers } from '@/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (!claims.tenantId && claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const companyDrivers = await tx
      .select({
        id: drivers.id,
        name: drivers.name,
        mobile: drivers.mobile,
      })
      .from(drivers)
      .where(and(
        eq(drivers.tenantId, tenantIdToUse),
        eq(drivers.status, 'ACTIVE'),
        isNull(drivers.deliveryPartnerId)
      ));

    return NextResponse.json({ data: companyDrivers });
  });
}
