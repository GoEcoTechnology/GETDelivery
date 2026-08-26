import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryAssignments, deliveryOrders, deliveryItems, products } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken, AppJwtPayload } from '@/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the driver token is valid
    const payload = await verifyToken(token) as AppJwtPayload;
    if (!payload || !('type' in payload) || payload.type !== 'DRIVER_ACCESS') {
      return NextResponse.json({ error: 'Invalid driver token' }, { status: 401 });
    }

    const assignmentId = parseInt((await params).assignmentId, 10);
    if (isNaN(assignmentId) || assignmentId !== payload.assignmentId) {
      return NextResponse.json({ error: 'Unauthorized access to assignment' }, { status: 403 });
    }

    // Fetch assignment, order, and items securely
    const [assignment] = await db.select().from(deliveryAssignments).where(eq(deliveryAssignments.id, assignmentId));
    
    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const [order] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, assignment.deliveryOrderId));
    
    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    // Fetch items with product names
    const items = await db
      .select({
        id: deliveryItems.id,
        quantity: deliveryItems.quantity,
        unit: deliveryItems.unit,
        productName: products.name
      })
      .from(deliveryItems)
      .innerJoin(products, eq(deliveryItems.productId, products.id))
      .where(eq(deliveryItems.deliveryOrderId, order.id));

    return NextResponse.json({
      data: {
        orderId: order.id,
        status: assignment.status,
        customerName: order.customerName,
        customerContact: order.customerContact,
        pickupAddress: order.pickupAddress,
        dropoffAddress: order.dropoffAddress,
        instructions: order.instructions,
        items
      }
    });

  } catch (error) {
    console.error('Failed to fetch driver assignment:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
