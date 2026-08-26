import { NextResponse } from 'next/server';
import { db, withRLS } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { verifyToken } from '@/lib/auth';
import { eq } from 'drizzle-orm';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const authHeader = request.headers.get('authorization');
  const claims = await verifyToken(authHeader || '');
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    return await withRLS(claims, async (tx) => {
      const [order] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.id, id));

      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (order.status !== 'DRAFT') return NextResponse.json({ error: 'Only DRAFT orders can be marked as ready' }, { status: 400 });

      const [updated] = await tx
        .update(deliveryOrders)
        .set({ status: 'READY_FOR_DISPATCH' })
        .where(eq(deliveryOrders.id, id))
        .returning();

      return NextResponse.json({ data: updated });
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
