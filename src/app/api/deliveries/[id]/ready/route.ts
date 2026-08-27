import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (tx, claims) => {
    const id = parseInt((await params).id, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, id),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT orders can be marked as ready' }, { status: 400 });

    const [updated] = await tx
      .update(deliveryOrders)
      .set({ status: 'READY_FOR_DISPATCH' })
      .where(eq(deliveryOrders.id, id))
      .returning();

    return NextResponse.json({ data: updated });
  });
}
