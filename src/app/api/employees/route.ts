import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

const MAX_EMPLOYEES = 3;

// GET - list employees for the tenant
export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'BUSINESS_OWNER' && claims.role !== 'EMPLOYEE') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const employees = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        status: users.status,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.tenantId, claims.tenantId as number), eq(users.role, 'EMPLOYEE')));

    return NextResponse.json({ data: employees, count: employees.length, max: MAX_EMPLOYEES });
  });
}

// POST - create a new employee (BUSINESS_OWNER only, max 3)
export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Only business owners can create employee accounts' }, { status: 403 });
    }

    // Count existing employees
    const [{ value: employeeCount }] = await tx
      .select({ value: count() })
      .from(users)
      .where(and(eq(users.tenantId, claims.tenantId as number), eq(users.role, 'EMPLOYEE')));

    if (Number(employeeCount) >= MAX_EMPLOYEES) {
      return NextResponse.json(
        { error: `You can only create up to ${MAX_EMPLOYEES} employee accounts` },
        { status: 400 }
      );
    }

    const { name, email, password } = await request.json();

    if (!name || !email || !password || password.length < 6) {
      return NextResponse.json(
        { error: 'Name, email, and password (min 6 chars) are required' },
        { status: 400 }
      );
    }

    // Check email uniqueness
    const [existing] = await tx.select().from(users).where(eq(users.email, email.toLowerCase()));
    if (existing) {
      return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
    }

    const { hashPassword } = await import('@/lib/password');
    const passwordHash = await hashPassword(password);

    const [newEmployee] = await tx.insert(users).values({
      tenantId: claims.tenantId!,
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: 'EMPLOYEE',
      status: 'ACTIVE', // No approval needed
    }).returning();

    const { passwordHash: _, ...safeEmployee } = newEmployee;
    return NextResponse.json({ data: safeEmployee }, { status: 201 });
  });
}
