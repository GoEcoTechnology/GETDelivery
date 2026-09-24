import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, customers, deliveryItems, products, productVariants, tenants } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('customerId'); // This is the user.id

  if (!userId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  try {
    // Get the customer record associated with this user
    const [customer] = await db.select().from(customers).where(eq(customers.userId, parseInt(userId)));
    if (!customer) {
      return NextResponse.json([], { status: 200 }); // No customer profile means no orders
    }

    // Get orders for this customer
    const rawOrders = await db.select({
      id: deliveryOrders.id,
      status: deliveryOrders.status,
      deliveryPriority: deliveryOrders.deliveryPriority,
      deliveryDate: deliveryOrders.deliveryDate,
      finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
      createdAt: deliveryOrders.createdAt,
      tenantId: deliveryOrders.tenantId,
      tenantName: tenants.name,
      instructions: deliveryOrders.instructions,
      vehicleBasePrice: deliveryOrders.vehicleBasePrice,
      pricePerKm: deliveryOrders.pricePerKm,
      distanceKm: deliveryOrders.distanceKm,
      normalDeliveryFee: deliveryOrders.normalDeliveryFee,
      urgentAdditionalFee: deliveryOrders.urgentAdditionalFee,
    })
    .from(deliveryOrders)
    .innerJoin(tenants, eq(deliveryOrders.tenantId, tenants.id))
    .where(eq(deliveryOrders.customerId, customer.id))
    .orderBy(desc(deliveryOrders.createdAt));

    // Get items for these orders
    const ordersWithItems = await Promise.all(rawOrders.map(async (order) => {
      const items = await db.select({
        quantity: deliveryItems.quantity,
        unit: deliveryItems.unit,
        productName: deliveryItems.productName,
        price: deliveryItems.unitPrice,
      })
      .from(deliveryItems)
      .where(eq(deliveryItems.deliveryOrderId, order.id));

      const totalAmount = items.reduce((sum, item) => sum + (Number(item.price || 0) * item.quantity), 0);

      return {
        ...order,
        items,
        totalAmount
      };
    }));

    return NextResponse.json(ordersWithItems);
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
