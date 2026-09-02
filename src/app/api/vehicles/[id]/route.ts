import { NextResponse } from 'next/server';
import { vehicles } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { plateNumber, vehicleType, status, orNumber, crNumber, registrationExpiry } = body;
    const parsedRegistrationExpiry = registrationExpiry ? new Date(registrationExpiry) : null;

    let condition = eq(vehicles.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(vehicles.tenantId, claims.tenantId as number)) as any;
    }

    const [updated] = await tx.update(vehicles)
      .set({
        plateNumber,
        vehicleType,
        status,
        orNumber: orNumber || null,
        crNumber: crNumber || null,
        registrationExpiry: parsedRegistrationExpiry,
      })
      .where(condition)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Vehicle not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    let condition = eq(vehicles.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(vehicles.tenantId, claims.tenantId as number)) as any;
    }

    const [deleted] = await tx.delete(vehicles).where(condition).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Vehicle not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  });
}
