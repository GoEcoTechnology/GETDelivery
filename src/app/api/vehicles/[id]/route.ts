import { NextResponse } from 'next/server';
import { vehicles, deliveryBatches } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { clearVehicleDeliveryCache } from '@/lib/deliveryCalculation';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { 
      plateNumber, 
      vehicleType, 
      status, 
      orNumber, 
      crNumber, 
      registrationExpiry, 
      capacityKg,
      cargoLengthCm,
      cargoWidthCm,
      cargoHeightCm
    } = body;
    const parsedRegistrationExpiry = registrationExpiry ? new Date(registrationExpiry) : null;

    let condition = eq(vehicles.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(vehicles.tenantId, claims.tenantId as number)) as any;
    }

    const updatePayload: Record<string, any> = {
      plateNumber,
      vehicleType,
      status,
      orNumber: orNumber || null,
      crNumber: crNumber || null,
      registrationExpiry: parsedRegistrationExpiry,
    };
    if (capacityKg !== undefined) updatePayload.capacityKg = Number(capacityKg);
    if (cargoLengthCm !== undefined) updatePayload.cargoLengthCm = Number(cargoLengthCm);
    if (cargoWidthCm !== undefined) updatePayload.cargoWidthCm = Number(cargoWidthCm);
    if (cargoHeightCm !== undefined) updatePayload.cargoHeightCm = Number(cargoHeightCm);

    const [updated] = await tx.update(vehicles)
      .set(updatePayload)
      .where(condition)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Vehicle not found or unauthorized' }, { status: 404 });
    }

    clearVehicleDeliveryCache();
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

    try {
      // 1. Unlink suggestedVehicleId from any batches referencing this vehicle
      await tx
        .update(deliveryBatches)
        .set({ suggestedVehicleId: null })
        .where(eq(deliveryBatches.suggestedVehicleId, id));

      // 2. Attempt direct deletion
      const [deleted] = await tx.delete(vehicles).where(condition).returning();
      if (!deleted) {
        return NextResponse.json({ error: 'Vehicle not found or unauthorized' }, { status: 404 });
      }

      clearVehicleDeliveryCache();
      return NextResponse.json({ success: true, data: deleted });
    } catch (err: any) {
      console.warn('Vehicle direct delete failed, archiving instead:', err.message);
      // Soft-delete if referenced in historical orders
      const [archived] = await tx
        .update(vehicles)
        .set({ status: 'ARCHIVED' })
        .where(condition)
        .returning();

      if (!archived) {
        return NextResponse.json({ error: 'Vehicle not found or unauthorized' }, { status: 404 });
      }

      clearVehicleDeliveryCache();
      return NextResponse.json({ success: true, data: archived, message: 'Vehicle deleted/archived successfully' });
    }
  });
}
