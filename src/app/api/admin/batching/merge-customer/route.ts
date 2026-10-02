import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
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
    const tenantId = claims.tenantId as number;

    const { sourceOrderId, targetOrderId } = await request.json();

    if (!sourceOrderId || !targetOrderId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify both orders belong to the tenant
    const [sourceOrder] = await db.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, sourceOrderId), eq(deliveryOrders.tenantId, tenantId)));
    const [targetOrder] = await db.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, targetOrderId), eq(deliveryOrders.tenantId, tenantId)));

    if (!sourceOrder || !targetOrder) {
      return NextResponse.json({ error: 'Invalid orders' }, { status: 400 });
    }

    if (sourceOrder.customerName !== targetOrder.customerName) {
      return NextResponse.json({ error: 'Cannot merge orders from different customers' }, { status: 400 });
    }

    // Move all items from source to target
    await db.update(deliveryItems)
      .set({ deliveryOrderId: targetOrderId })
      .where(eq(deliveryItems.deliveryOrderId, sourceOrderId));

    // Update fees on target (sum them up)
    const newNormalFee = Number(targetOrder.normalDeliveryFee || 0) + Number(sourceOrder.normalDeliveryFee || 0);
    const newUrgentFee = Number(targetOrder.urgentAdditionalFee || 0) + Number(sourceOrder.urgentAdditionalFee || 0);
    
    // Also promote priority if source was urgent
    const isUrgent = sourceOrder.deliveryPriority === 'URGENT' || targetOrder.deliveryPriority === 'URGENT';
    const urgentReason = targetOrder.urgentReason || sourceOrder.urgentReason || null;

    await db.update(deliveryOrders)
      .set({
        normalDeliveryFee: newNormalFee.toString(),
        urgentAdditionalFee: newUrgentFee.toString(),
        deliveryPriority: isUrgent ? 'URGENT' : 'STANDARD',
        urgentReason: urgentReason
      })
      .where(eq(deliveryOrders.id, targetOrderId));

    // Delete the source order
    await db.delete(deliveryOrders).where(eq(deliveryOrders.id, sourceOrderId));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('API /admin/batching/merge-customer Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
