import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryPartners, drivers, vehicles, deliveryInvitations, deliveryAssignments, deliveryOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { companyName, contactPerson, mobileNumber, email, status } = body;

    const updateData: any = {};
    if (companyName !== undefined) updateData.companyName = companyName;
    if (contactPerson !== undefined) updateData.contactPerson = contactPerson;
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber;
    if (email !== undefined) updateData.email = email;
    if (status !== undefined) updateData.status = status;

    const [partner] = await tx
      .update(deliveryPartners)
      .set(updateData)
      .where(eq(deliveryPartners.id, id))
      .returning();

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ data: partner });
  });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const params = await context.params;
    const id = parseInt(params.id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    // Handle foreign key dependencies before deleting the partner
    await tx.delete(drivers).where(eq(drivers.deliveryPartnerId, id));
    await tx.delete(vehicles).where(eq(vehicles.deliveryPartnerId, id));
    await tx.delete(deliveryInvitations).where(eq(deliveryInvitations.deliveryPartnerId, id));
    await tx.delete(deliveryAssignments).where(eq(deliveryAssignments.deliveryPartnerId, id));
    await tx.update(deliveryOrders).set({ temporaryWinnerId: null }).where(eq(deliveryOrders.temporaryWinnerId, id));

    const [partner] = await tx
      .delete(deliveryPartners)
      .where(eq(deliveryPartners.id, id))
      .returning();

    if (!partner) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  });
}
