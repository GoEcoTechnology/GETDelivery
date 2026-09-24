import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryItems } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized or missing tenant ID' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;

    const { id } = await params;
    const orderId = parseInt(id, 10);
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }

    // Ensure the order belongs to the tenant
    const order = await db.select().from(deliveryOrders).where(and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, tenantId))).limit(1);
    
    if (!order || order.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Delete items first if there's a constraint, but drizzle with cascade usually handles it.
    // Assuming no strict constraint or cascade is enabled, but manual deletion is safer.
    await db.delete(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));
    await db.delete(deliveryOrders).where(eq(deliveryOrders.id, orderId));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting admin order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
