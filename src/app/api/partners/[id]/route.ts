import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryPartners } from '@/db/schema';
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

    const [partner] = await tx
      .update(deliveryPartners)
      .set({
        companyName,
        contactPerson,
        mobileNumber,
        email,
        status,
        updatedAt: new Date(),
      })
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
