import { NextResponse } from 'next/server';
import { users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { hashPassword } from '@/lib/password';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['employee.view'] }, async (tx, claims) => {
    // Only BUSINESS_OWNER or PLATFORM_OWNER should see tenant users
    if (!claims.tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const data = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt
      })
      .from(users)
      .where(eq(users.tenantId, claims.tenantId as number))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ data });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['employee.create'] }, async (tx, claims) => {
    const body = await request.json();

    if (!claims.tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const role = 'EMPLOYEE'; // Force EMPLOYEE role for tenant staff

    if (!name || !email || password.length < 6) {
      return NextResponse.json({ error: 'Invalid name, email, or short password' }, { status: 400 });
    }

    // Check if email exists
    const [existing] = await tx.select().from(users).where(eq(users.email, email));
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const [newUser] = await tx.insert(users).values({
      tenantId: claims.tenantId,
      name,
      email,
      passwordHash,
      role,
      status: 'ACTIVE'
    }).returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role
    });

    return NextResponse.json({ data: newUser }, { status: 201 });
  });
}
