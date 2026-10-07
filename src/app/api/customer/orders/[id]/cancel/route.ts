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

    // Only allow cancellation if not yet accepted/dispatched
    const cancellableStatuses = ['DRAFT', 'WAITING_FOR_PARTNER', 'WAITING', 'PROCESSING', 'READY_FOR_DELIVERY'];
    if (!cancellableStatuses.includes(order.status)) {
      return NextResponse.json(
        { message: 'Order cannot be cancelled because it has already been processed or dispatched.' },
        { status: 400 }
      );
    }

    // Update status to CANCELLED and clear batchId
    await db.update(deliveryOrders)
      .set({
        status: 'CANCELLED',
        batchId: null
      })
      .where(eq(deliveryOrders.id, orderId));

    // If order was part of a batch, decrement batch totals and remove the item
    if (order.batchId) {
      const { and, eq } = require('drizzle-orm');
      const { deliveryBatches, deliveryBatchItems } = require('@/db/schema');
      
      const batchItem = await db.query.deliveryBatchItems.findFirst({
        where: and(
          eq(deliveryBatchItems.batchId, order.batchId),
          eq(deliveryBatchItems.customerOrderId, orderId)
        )
      });

      if (batchItem) {
        const batch = await db.query.deliveryBatches.findFirst({
          where: eq(deliveryBatches.id, order.batchId)
        });

        if (batch) {
          const newQty = Math.max(0, batch.totalQuantity - batchItem.quantity);
          const newWeight = Math.max(0, Number(batch.totalWeight) - Number(batchItem.customerWeight));
          
          await db.update(deliveryBatches)
            .set({
              totalQuantity: newQty,
              totalWeight: newWeight.toString()
            })
            .where(eq(deliveryBatches.id, batch.id));
            
          if (newQty === 0) {
             // Optional cleanup: If the batch becomes completely empty, delete the batch.
             await db.delete(deliveryBatches).where(eq(deliveryBatches.id, batch.id));
          }
        }

        await db.delete(deliveryBatchItems).where(eq(deliveryBatchItems.id, batchItem.id));
      }
    }

    return NextResponse.json({ success: true, message: 'Order cancelled successfully' });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    );
  }
}
