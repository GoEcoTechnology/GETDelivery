import { NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicles } from '@/db/schema';
import { desc, eq, and, ilike, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;
    
    let conditions: any = undefined;
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = eq(vehicles.tenantId, claims.tenantId as number);
    }
    
    if (search) {
      const searchCond = ilike(vehicles.plateNumber, `%${search}%`);
      conditions = conditions ? and(conditions, searchCond) : searchCond;
    }

    const data = await tx
      .select({
        id: vehicles.id,
        plateNumber: vehicles.plateNumber,
        vehicleType: vehicles.vehicleType,
        status: vehicles.status,
        orNumber: vehicles.orNumber,
        crNumber: vehicles.crNumber,
        registrationExpiry: vehicles.registrationExpiry,
        createdAt: vehicles.createdAt,
      })
      .from(vehicles)
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(vehicles.createdAt));

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(vehicles)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { plateNumber, vehicleType, deliveryPartnerId } = await request.json();

    if (!plateNumber || !vehicleType) {
      return NextResponse.json({ error: 'Plate Number and Vehicle Type are required' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required to register a vehicle' }, { status: 400 });
    }

    const [newVehicle] = await tx.insert(vehicles).values({
      tenantId: tenantIdToUse,
      deliveryPartnerId: deliveryPartnerId || null,
      plateNumber,
      vehicleType,
      status: 'ACTIVE'
    }).returning();

    return NextResponse.json({ data: newVehicle }, { status: 201 });
  });
}
