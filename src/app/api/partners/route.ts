import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryPartners } from '@/db/schema';
import { eq, and, like, desc, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '7', 10);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const offset = (page - 1) * limit;

    let conditions: any[] = [];
    if (search) conditions.push(like(deliveryPartners.companyName, `%${search}%`));
    if (status) conditions.push(eq(deliveryPartners.status, status as any));

    const whereClause = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

    const data = await tx
      .select()
      .from(deliveryPartners)
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(deliveryPartners.createdAt));

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(deliveryPartners)
      .where(whereClause);

    return NextResponse.json({ data, totalCount: Number(count) });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyName, contactPerson, mobileNumber, email, password, status } = body;

    if (!companyName || !contactPerson || !mobileNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { hashPassword } = await import('@/lib/password');
    const passwordHash = await hashPassword(password);

    const [partner] = await tx.insert(deliveryPartners).values({
      companyName,
      contactPerson,
      mobileNumber,
      email,
      passwordHash,
      status: status || 'ACTIVE',
    }).returning();

    return NextResponse.json({ data: partner }, { status: 201 });
  });
}
