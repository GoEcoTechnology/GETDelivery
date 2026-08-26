import { NextResponse } from 'next/server';
import { db } from '@/db';
import { drivers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { name, mobile, status } = body;

    let condition = eq(drivers.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(drivers.tenantId, claims.tenantId as number)) as any;
    }

    const [updated] = await tx.update(drivers)
      .set({
        name,
        mobile,
        status,
        updatedAt: new Date()
      })
      .where(condition)
      .returning();

    if (!updated) {
      return NextResponse.json({ error: 'Driver not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['delivery.manage'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    let condition = eq(drivers.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(drivers.tenantId, claims.tenantId as number)) as any;
    }

    const [deleted] = await tx.delete(drivers).where(condition).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Driver not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  });
}
