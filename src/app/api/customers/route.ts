import { NextResponse } from 'next/server';
import { customers } from '@/db/schema';
import { eq, ilike, or, and, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const offset = (page - 1) * limit;

    let whereClause = claims.role === 'PLATFORM_OWNER' 
      ? undefined 
      : eq(customers.tenantId, claims.tenantId as number);

    if (search) {
      whereClause = and(
        whereClause,
        or(
          ilike(customers.name, `%${search}%`),
          ilike(customers.mobileNumber, `%${search}%`)
        )
      );
    }

    const data = await tx.select({
      id: customers.id,
      name: customers.name,
      mobileNumber: customers.mobileNumber,
      email: customers.email,
      address: customers.address,
      barangay: customers.barangay,
      municipality: customers.municipality,
      contactPerson: customers.contactPerson,
      status: customers.status
    })
      .from(customers)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(customers.createdAt));

    return NextResponse.json({ 
      data, 
      totalCount: data.length,
      page,
      limit
    });
  });
}

export async function POST(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (!('role' in claims) || claims.role === 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    
    const [newCustomer] = await tx.insert(customers).values({
      tenantId: claims.tenantId as number,
      name: body.name,
      contactPerson: body.contactPerson,
      mobileNumber: body.mobileNumber,
      email: body.email,
      address: body.address,
      municipality: body.municipality,
      barangay: body.barangay,
      status: body.status || 'ACTIVE'
    }).returning();

    return NextResponse.json({ data: newCustomer }, { status: 201 });
  });
}
