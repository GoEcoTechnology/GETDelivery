import { NextResponse } from 'next/server';
import { tenants, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const { status } = await request.json();
    if (!status) return NextResponse.json({ error: 'Status is required' }, { status: 400 });

    // Update tenant status
    const [updatedTenant] = await tx.update(tenants)
      .set({ status })
      .where(eq(tenants.id, id))
      .returning();

    if (!updatedTenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Sync the BUSINESS_OWNER user status: ACTIVE when approved, INACTIVE when declined
    const userStatus = status === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE';
    await tx.update(users)
      .set({ status: userStatus })
      .where(and(eq(users.tenantId, id), eq(users.role, 'BUSINESS_OWNER')));

    return NextResponse.json({ data: updatedTenant });
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { name, contactPerson, status, email } = body;

    const tenantUpdateData: any = {};
    if (name !== undefined) tenantUpdateData.name = name;
    if (contactPerson !== undefined) tenantUpdateData.contactPerson = contactPerson;
    if (status !== undefined) tenantUpdateData.status = status;

    let updated;
    if (Object.keys(tenantUpdateData).length > 0) {
      const [result] = await tx.update(tenants)
        .set(tenantUpdateData)
        .where(eq(tenants.id, id))
        .returning();
      updated = result;
    }

    if (!updated && Object.keys(tenantUpdateData).length > 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const userUpdateData: any = {};
    if (email !== undefined) userUpdateData.email = email;
    if (contactPerson !== undefined) userUpdateData.name = contactPerson;

    if (Object.keys(userUpdateData).length > 0) {
      await tx.update(users)
        .set(userUpdateData)
        .where(and(eq(users.tenantId, id), eq(users.role, 'BUSINESS_OWNER')));
    }

    return NextResponse.json({ data: updated || { success: true } });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['platform.manage_tenants'] }, async (tx) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    // Delete associated users first to avoid FK constraint errors
    await tx.delete(users).where(eq(users.tenantId, id));

    const [deleted] = await tx.delete(tenants).where(eq(tenants.id, id)).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  });
}
