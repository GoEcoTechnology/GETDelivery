import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq, ilike, or, and, desc, sql } from 'drizzle-orm';
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
          ilike(customers.customerCode, `%${search}%`),
          ilike(customers.mobileNumber, `%${search}%`)
        )
      ) as any;
    }

    const data = await tx.select()
      .from(customers)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(customers.createdAt));

    const totalResult = await tx.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(whereClause);

    return NextResponse.json({ 
      data, 
      totalCount: totalResult[0].count,
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
    
    // Generate a unique customer code
    const countResult = await tx.select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(eq(customers.tenantId, claims.tenantId as number));
    
    const nextNum = (countResult[0].count + 1).toString().padStart(4, '0');
    const customerCode = `CUS-${nextNum}`;

    const [newCustomer] = await tx.insert(customers).values({
      tenantId: claims.tenantId as number,
      customerCode,
      name: body.name,
      contactPerson: body.contactPerson,
      mobileNumber: body.mobileNumber,
      email: body.email,
      address: body.address,
      municipality: body.municipality,
      barangay: body.barangay,
      notes: body.notes,
      status: body.status || 'ACTIVE'
    }).returning();

    return NextResponse.json({ data: newCustomer }, { status: 201 });
  });
}
