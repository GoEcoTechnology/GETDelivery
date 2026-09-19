import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryAssignments, deliveryOrders, deliveryItems, products } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
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

    const [mainOrder] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, assignment.deliveryOrderId));
    
    if (!mainOrder) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    // If order is part of a batch, fetch all orders in that batch. Otherwise, just the main order.
    let ordersToFetch = [mainOrder];
    if (mainOrder.batchId) {
      ordersToFetch = await db.select().from(deliveryOrders).where(eq(deliveryOrders.batchId, mainOrder.batchId));
    }

    const orderIds = ordersToFetch.map(o => o.id);

    // Fetch items with product names for all orders in the batch
    const allItems = await db
      .select({
        id: deliveryItems.id,
        orderId: deliveryItems.deliveryOrderId,
        quantity: deliveryItems.quantity,
        unit: deliveryItems.unit,
        productName: products.name
      })
      .from(deliveryItems)
      .innerJoin(products, eq(deliveryItems.productId, products.id))
      .where(inArray(deliveryItems.deliveryOrderId, orderIds));

    // Structure the data to support multiple orders
    const structuredOrders = ordersToFetch.map(o => ({
      orderId: o.id,
      customerName: o.customerName,
      customerContact: o.customerContact,
      pickupAddress: o.pickupAddress,
      pickupLat: o.pickupLat,
      pickupLng: o.pickupLng,
      dropoffAddress: o.dropoffAddress,
      dropoffLat: o.dropoffLat,
      dropoffLng: o.dropoffLng,
      instructions: o.instructions,
      items: allItems.filter(item => item.orderId === o.id).map(({ orderId, ...rest }) => rest)
    }));

    return NextResponse.json({
      data: {
        assignmentId: assignment.id,
        status: assignment.status,
        batchId: mainOrder.batchId,
        orders: structuredOrders
      }
    });

  } catch (error) {
    console.error('Failed to fetch driver assignment:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
