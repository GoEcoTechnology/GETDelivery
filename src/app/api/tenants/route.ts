import { NextResponse } from 'next/server';
import { tenants, users } from '@/db/schema';
import { desc, ilike, sql, eq, and, ne } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '7', 10);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const excludeStatus = searchParams.get('excludeStatus') || '';

    const offset = (page - 1) * limit;

    const conditions = [
      search ? ilike(tenants.name, `%${search}%`) : undefined,
      status ? eq(tenants.status, status as any) : undefined,
      excludeStatus ? ne(tenants.status, excludeStatus as any) : undefined,
    ].filter(Boolean);

    const whereClause = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? and(...(conditions as any[])) : undefined;

    const data = await tx
      .select({
        id: tenants.id,
        name: tenants.name,
        contactPerson: tenants.contactPerson,
        status: tenants.status,
        createdAt: tenants.createdAt,
        email: users.email,
      })
      .from(tenants)
      .leftJoin(users, and(eq(users.tenantId, tenants.id), eq(users.role, 'BUSINESS_OWNER')))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(tenants.createdAt));

    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(tenants)
      .where(whereClause);
      
    const totalCount = Number(countResult[0]?.count || 0);

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx) => {
    const { name, contactPerson, email, password } = await request.json();

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
      contactPerson: contactPerson || null,
      status: 'ACTIVE'
    }).returning();

    // Create the business owner for the tenant
    await tx.insert(users).values({
      tenantId: newTenant.id,
      name: contactPerson || `Owner of ${name}`,
      email: email.toLowerCase(),
      passwordHash,
      role: 'BUSINESS_OWNER',
      status: 'ACTIVE'
    });

    return NextResponse.json({ data: newTenant }, { status: 201 });
  });
}
