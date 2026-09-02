import { NextResponse } from 'next/server';
import { customers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (tx, claims) => {
    if (!('role' in claims) || claims.role === 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const customerId = parseInt((await params).id);
    const body = await request.json();

    const [updated] = await tx.update(customers)
      .set({
        name: body.name,
        contactPerson: body.contactPerson,
        mobileNumber: body.mobileNumber,
        email: body.email,
        address: body.address,
        municipality: body.municipality,
        barangay: body.barangay,
        status: body.status,
        updatedAt: new Date()
      })
      .where(and(
        eq(customers.id, customerId),
        eq(customers.tenantId, claims.tenantId as number)
      ))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, async (tx, claims) => {
    if (!('role' in claims) || claims.role === 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const customerId = parseInt((await params).id);

    const [deleted] = await tx.delete(customers)
      .where(and(
        eq(customers.id, customerId),
        eq(customers.tenantId, claims.tenantId as number)
      ))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  });
}
