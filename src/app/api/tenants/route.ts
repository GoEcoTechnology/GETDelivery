import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenants, users } from '@/db/schema';
import { desc, ilike, sql, eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;
    
    let conditions: any = undefined;
    if (search) {
      conditions = ilike(tenants.name, `%${search}%`);
    }

    const data = await tx
      .select({
        id: tenants.id,
        name: tenants.name,
        subscriptionPlan: tenants.subscriptionPlan,
        status: tenants.status,
        createdAt: tenants.createdAt,
        email: users.email,
      })
      .from(tenants)
      .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, 'BUSINESS_OWNER')))
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(tenants.createdAt));

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(tenants)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx, claims) => {
    const { name, subscriptionPlan, email, password } = await request.json();

    if (!name) {
      return NextResponse.json({ error: 'Tenant name is required' }, { status: 400 });
    }
    if (!email || !password || password.length < 6) {
      return NextResponse.json({ error: 'Valid email and password (min 6 chars) are required' }, { status: 400 });
    }

    // Check if email already exists to prevent unique constraint error on users table
    const [existingUser] = await tx.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existingUser) {
      return NextResponse.json({ error: 'Email is already in use by another account' }, { status: 400 });
    }

    const { hashPassword } = await import('@/lib/password');
    const passwordHash = await hashPassword(password);

    // Create the tenant
    const [newTenant] = await tx.insert(tenants).values({
      name,
      subscriptionPlan: subscriptionPlan || 'FREE',
      status: 'ACTIVE'
    }).returning();

    // Create the business owner for the tenant
    await tx.insert(users).values({
      tenantId: newTenant.id,
      name: `Owner of ${name}`,
      email: email.toLowerCase(),
      passwordHash,
      role: 'BUSINESS_OWNER',
      status: 'ACTIVE'
    });

    return NextResponse.json({ data: newTenant }, { status: 201 });
  });
}
