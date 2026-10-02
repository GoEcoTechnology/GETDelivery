import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, customers, deliveryItems, tenants, users, deliveryPartners, deliveryAssignments } from '@/db/schema';
import { eq, desc, and, lt } from 'drizzle-orm';

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

    // Clean up old cancelled orders (> 24 hours old)
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    await db.delete(deliveryOrders)
      .where(
        and(
          eq(deliveryOrders.status, 'CANCELLED'),
          lt(deliveryOrders.cancelledAt, oneDayAgo)
        )
      );

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
      routeDistance: deliveryOrders.routeDistance,
      normalDeliveryFee: deliveryOrders.normalDeliveryFee,
      urgentAdditionalFee: deliveryOrders.urgentAdditionalFee,
      dropoffLat: deliveryOrders.dropoffLat,
      dropoffLng: deliveryOrders.dropoffLng,
      tenantLat: tenants.lat,
      tenantLng: tenants.lng,
      temporaryWinnerId: deliveryOrders.temporaryWinnerId,
      partnerDriverName: deliveryOrders.partnerDriverName,
      partnerDriverContact: deliveryOrders.partnerDriverContact,
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

      let computedDistance = Number(order.distanceKm || order.routeDistance || 0);
      if (computedDistance === 0 && order.tenantLat && order.tenantLng && order.dropoffLat && order.dropoffLng) {
        computedDistance = getDistanceFromLatLonInKm(
          Number(order.tenantLat),
          Number(order.tenantLng),
          Number(order.dropoffLat),
          Number(order.dropoffLng)
        ) * 1.3;
      }

      const [businessOwner] = await db.select({
        name: users.name,
        contactNumber: users.contactNumber,
        email: users.email
      })
      .from(users)
      .where(and(eq(users.tenantId, order.tenantId), eq(users.role, 'BUSINESS_OWNER')))
      .limit(1);

      let partnerDetails = null;
      if (order.temporaryWinnerId) {
        const [partner] = await db.select({
          name: deliveryPartners.contactPerson,
          contact: deliveryPartners.mobileNumber,
          businessName: deliveryPartners.companyName
        })
        .from(deliveryPartners)
        .where(eq(deliveryPartners.id, order.temporaryWinnerId))
        .limit(1);

        partnerDetails = {
           name: partner?.businessName || partner?.name || 'Partner',
           contact: partner?.contact,
           driverName: order.partnerDriverName,
           driverContact: order.partnerDriverContact
        };
      } else {
        const [assignment] = await db.select({
          driverName: deliveryAssignments.driverName,
          vehicleDetails: deliveryAssignments.vehicleDetails,
        })
        .from(deliveryAssignments)
        .where(eq(deliveryAssignments.deliveryOrderId, order.id))
        .orderBy(desc(deliveryAssignments.assignedAt))
        .limit(1);

        if (assignment) {
          partnerDetails = {
            name: order.tenantName + ' (Internal Fleet)',
            driverName: assignment.driverName,
            vehicleDetails: assignment.vehicleDetails
          };
        }
      }

      return {
        ...order,
        distanceKm: computedDistance.toString(),
        items,
        totalAmount,
        businessOwner,
        partnerDetails
      };
    }));

    return NextResponse.json(ordersWithItems);
  } catch (err) {
    console.error('Error fetching customer orders:', err);
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}
