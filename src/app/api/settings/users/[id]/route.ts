import { NextResponse } from 'next/server';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { hashPassword } from '@/lib/password';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['employee.update'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });

    const body = await request.json();

    if (!claims.tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Verify user belongs to tenant
    const [targetUser] = await tx.select().from(users).where(
      and(eq(users.id, id), eq(users.tenantId, claims.tenantId as number))
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const updates: any = {};
    if (body.name) updates.name = String(body.name).trim();
    if (body.status) updates.status = String(body.status).trim();
    if (body.password && body.password.length >= 6) {
      updates.passwordHash = await hashPassword(body.password);
    }

    if (Object.keys(updates).length > 0) {
      await tx.update(users).set(updates).where(eq(users.id, id));
    }

    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['employee.delete'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 });

    if (!claims.tenantId) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // Verify user belongs to tenant and is not the owner trying to delete themselves
    if (id === claims.userId) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const [targetUser] = await tx.select().from(users).where(
      and(eq(users.id, id), eq(users.tenantId, claims.tenantId as number))
    );

    if (!targetUser) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Delete or soft-delete (Revoke Access)
    await tx.delete(users).where(eq(users.id, id));

    return NextResponse.json({ success: true });
  });
}
