import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, customers, deliveryItems, tenants, users, deliveryPartners, deliveryAssignments, vehicles, vehicleDeliveryRates, productVariants } from '@/db/schema';
import { eq, desc, and, lt, gt, gte, asc, ilike, inArray, notInArray, or, sql } from 'drizzle-orm';
import { purgeExpiredDeliveries } from '@/lib/delivery-purge';

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

    // Clean up expired cancelled orders (older than 1 week) and expired completed deliveries (older than 1 month)
    await purgeExpiredDeliveries();

    // Completed orders on the customer side are removed/hidden after 1 week (7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get orders for this customer
    const rawOrders = await db.select({
      id: deliveryOrders.id,
      status: deliveryOrders.status,
      deliveryPriority: deliveryOrders.deliveryPriority,
      deliveryDate: deliveryOrders.deliveryDate,
      completedAt: deliveryOrders.completedAt,
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
      totalWeight: deliveryOrders.totalWeight,
      quota: deliveryOrders.quota,
      preferredVehicle: deliveryOrders.preferredVehicle,
      requiredVehicleType: deliveryOrders.requiredVehicleType,
      vehicleCapacityKg: deliveryOrders.vehicleCapacityKg,
    })
      .from(deliveryOrders)
      .innerJoin(tenants, eq(deliveryOrders.tenantId, tenants.id))
      .where(
        and(
          eq(deliveryOrders.customerId, customer.id),
          // Exclude completed/delivered orders older than 1 week (7 days)
          or(
            notInArray(deliveryOrders.status, ['DELIVERED', 'COMPLETED']),
            gt(deliveryOrders.completedAt, oneWeekAgo),
            and(sql`${deliveryOrders.completedAt} IS NULL`, gt(deliveryOrders.createdAt, oneWeekAgo))
          )
        )
      )
      .orderBy(desc(deliveryOrders.createdAt));

    // Get items and ensure authoritative vehicle selection and weight for these orders
    const ordersWithItems = await Promise.all(rawOrders.map(async (order) => {
      const items = await db.select({
        id: deliveryItems.id,
        variantId: deliveryItems.variantId,
        quantity: deliveryItems.quantity,
        unit: deliveryItems.unit,
        productName: deliveryItems.productName,
        price: deliveryItems.unitPrice,
        weightKg: deliveryItems.weightKg,
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

      // Check if order cargo weight is missing or needs vehicle reconciliation
      let orderWeight = Number(order.totalWeight) || 0;
      let preferredVehicle = order.preferredVehicle;
      let vehicleCapacityKg = order.vehicleCapacityKg;
      let vehicleBasePrice = order.vehicleBasePrice;
      let pricePerKm = order.pricePerKm;
      let normalDeliveryFee = order.normalDeliveryFee;
      let finalDeliveryPrice = order.finalDeliveryPrice;

      if (orderWeight <= 0) {
        const vIds = items.map(i => i.variantId).filter(Boolean) as number[];
        if (vIds.length > 0) {
          const dbVariants = await db.select().from(productVariants).where(inArray(productVariants.id, vIds));
          const vMap = new Map(dbVariants.map(v => [v.id, v]));
          for (const item of items) {
            const v = item.variantId ? vMap.get(item.variantId) : null;
            const wPerUnit = Number(v?.weightKg || v?.weightPerPieceKg || v?.weight || 0);
            const itemWeight = item.quantity * wPerUnit;
            orderWeight += itemWeight;
            if (!item.weightKg && itemWeight > 0) {
              await db.update(deliveryItems).set({ weightKg: itemWeight.toFixed(2) }).where(eq(deliveryItems.id, item.id));
            }
          }
        }
      }

      // Reconcile vehicle assignment if vehicle is undersized or missing
      if (orderWeight > 0 && (!vehicleCapacityKg || vehicleCapacityKg < orderWeight || !preferredVehicle)) {
        // Query Super Admin configured rates first
        const configuredRates = await db
          .select()
          .from(vehicleDeliveryRates)
          .where(and(eq(vehicleDeliveryRates.isActive, true), gte(vehicleDeliveryRates.capacityKg, Math.ceil(orderWeight))))
          .orderBy(asc(vehicleDeliveryRates.capacityKg), asc(vehicleDeliveryRates.pricePerKm));

        const eligible = await db
          .select({
            id: vehicles.id,
            vehicleType: vehicles.vehicleType,
            capacityKg: vehicles.capacityKg,
            tenantId: vehicles.tenantId,
          })
          .from(vehicles)
          .where(
            and(
              eq(vehicles.status, 'ACTIVE'),
              gte(vehicles.capacityKg, Math.ceil(orderWeight))
            )
          )
          .orderBy(asc(vehicles.capacityKg));

        const tenantEligible = eligible.filter(v => v.tenantId === order.tenantId);
        const bestVehicle = tenantEligible[0] || eligible[0] || configuredRates[0];

        if (bestVehicle) {
          preferredVehicle = bestVehicle.vehicleType;
          vehicleCapacityKg = bestVehicle.capacityKg;

          const [matchedRate] = await db
            .select()
            .from(vehicleDeliveryRates)
            .where(and(ilike(vehicleDeliveryRates.vehicleType, bestVehicle.vehicleType), eq(vehicleDeliveryRates.isActive, true)))
            .limit(1);

          const baseFeeVal = 0; // Strictly 0 base fee
          const perKmVal = Number(matchedRate?.pricePerKm || 20);
          const distanceFeeVal = Math.round(computedDistance * perKmVal * 100) / 100;
          const normalFeeVal = distanceFeeVal;
          const urgentFeeVal = order.deliveryPriority === 'URGENT' ? Number(order.urgentAdditionalFee || 0) : 0;
          const finalFeeVal = Math.round((normalFeeVal + urgentFeeVal) * 100) / 100;

          vehicleBasePrice = '0.00';
          pricePerKm = perKmVal.toFixed(2);
          normalDeliveryFee = normalFeeVal.toFixed(2);
          finalDeliveryPrice = finalFeeVal.toFixed(2);

          await db.update(deliveryOrders)
            .set({
              totalWeight: orderWeight.toFixed(2),
              preferredVehicle,
              requiredVehicleType: preferredVehicle,
              vehicleCapacityKg,
              suggestedVehicleId: bestVehicle.id,
              vehicleBasePrice,
              pricePerKm,
              normalDeliveryFee,
              finalDeliveryPrice,
            })
            .where(eq(deliveryOrders.id, order.id));
        }
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
        totalWeight: orderWeight > 0 ? orderWeight.toFixed(2) : order.totalWeight,
        preferredVehicle,
        requiredVehicleType: preferredVehicle,
        vehicleCapacityKg,
        vehicleBasePrice,
        pricePerKm,
        normalDeliveryFee,
        finalDeliveryPrice,
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
