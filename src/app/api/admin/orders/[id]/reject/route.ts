import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    
    const params = await context.params;
    const orderId = parseInt(params.id, 10);

    const [order] = await db
      .update(deliveryOrders)
      .set({ status: 'CANCELLED' })
      .where(and(
        eq(deliveryOrders.id, orderId),
        eq(deliveryOrders.tenantId, claims.tenantId as number)
      ))
      .returning();

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: order });
  } catch (error: any) {
    console.error('Error rejecting order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
