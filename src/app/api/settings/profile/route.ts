import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users, tenants } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { hashPassword } from '@/lib/password';

export async function GET(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    // 1. Get User Profile
    const [user] = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId
      })
      .from(users)
      .where(eq(users.id, claims.userId as number));

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // 2. Get Tenant Profile if applicable
    let tenant = null;
    if (user.tenantId) {
      const [t] = await tx.select().from(tenants).where(eq(tenants.id, user.tenantId));
      tenant = t;
    }

    return NextResponse.json({ user, tenant });
  });
}

export async function PUT(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    const body = await request.json();
    
    // User Updates
    const updates: any = {};
    if (body.name) updates.name = String(body.name).trim();
    if (body.password) updates.passwordHash = await hashPassword(body.password);

    if (Object.keys(updates).length > 0) {
      await tx.update(users).set(updates).where(eq(users.id, claims.userId as number));
    }

    // Tenant Updates (Only Business Owners can update Tenant details)
    if (claims.role === 'BUSINESS_OWNER' && claims.tenantId && body.businessName) {
      await tx.update(tenants)
        .set({ name: String(body.businessName).trim() })
        .where(eq(tenants.id, claims.tenantId as number));
    }

    return NextResponse.json({ success: true });
  });
}
