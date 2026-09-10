import { NextResponse } from 'next/server';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { desc, eq, and, ilike, sql, isNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;
    
    let conditions: any = isNull(drivers.deliveryPartnerId);
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = and(conditions, eq(drivers.tenantId, claims.tenantId as number));
    }
    
    if (search) {
      const searchCond = ilike(drivers.name, `%${search}%`);
      conditions = and(conditions, searchCond);
    }

    const data = await tx
      .select({
        id: drivers.id,
        name: drivers.name,
        mobile: drivers.mobile,
        status: drivers.status,
        licenseNumber: drivers.licenseNumber,
        licenseType: drivers.licenseType,
        licenseExpiry: drivers.licenseExpiry,
        createdAt: drivers.createdAt,
      })
      .from(drivers)
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(drivers.createdAt));

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(drivers)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { name, mobile, deliveryPartnerId, licenseNumber, licenseType, licenseExpiry } = await request.json();

    if (!name || !mobile) {
      return NextResponse.json({ error: 'Name and Mobile Number are required' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required to create a driver' }, { status: 400 });
    }

    const [newDriver] = await tx.insert(drivers).values({
      tenantId: tenantIdToUse,
      deliveryPartnerId: deliveryPartnerId || null,
      name,
      mobile,
      status: 'ACTIVE',
      licenseNumber: licenseNumber ? String(licenseNumber).trim() : null,
      licenseType: licenseType ? String(licenseType).trim() : null,
      licenseExpiry: licenseExpiry ? new Date(licenseExpiry) : null,
    }).returning();

    return NextResponse.json({ data: newDriver }, { status: 201 });
  });
}

