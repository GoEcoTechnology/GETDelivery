import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = Number(id);
    if (isNaN(orderId)) {
      return NextResponse.json({ message: 'Invalid order ID' }, { status: 400 });
    }

    // First fetch the order to check its status
    const order = await db.query.deliveryOrders.findFirst({
      where: eq(deliveryOrders.id, orderId)
    });

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Only allow cancellation if DRAFT or WAITING_FOR_PARTNER
    if (order.status !== 'DRAFT' && order.status !== 'WAITING_FOR_PARTNER') {
      return NextResponse.json(
        { message: 'Order cannot be cancelled because it has already been processed or dispatched.' },
        { status: 400 }
      );
    }

    // Update status to CANCELLED
    await db.update(deliveryOrders)
      .set({
        status: 'CANCELLED',
      })
      .where(eq(deliveryOrders.id, orderId));

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
