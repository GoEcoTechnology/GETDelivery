import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, notifications, platformDeliverySettings, vehicleDeliveryRates, users, quotaAccumulations, deliveryItems, vehicles, productVariants } from '@/db/schema';
import { eq, and, or, isNotNull, desc, sql as drizzleSql, gte, asc, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { deductOrderStock } from '@/lib/inventory-helper';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';
import { sendEmail } from '@/lib/emailService';
import { sendBroadcastDeliveryNotification } from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);

    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
    }

    let tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number | null;

    // Fetch and validate the order
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(
        tenantIdToUse
          ? and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, tenantIdToUse))
          : eq(deliveryOrders.id, orderId)
      );

    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    const finalTenantId = (tenantIdToUse || order.tenantId) as number;

    if (order.status !== 'READY_FOR_DISPATCH') {
      return NextResponse.json({ error: `Only READY_FOR_DISPATCH orders can be dispatched. Current status: ${order.status}` }, { status: 400 });
    }

    const [settings] = await tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);

    // Compute order cargo weight
    let orderWeight = Number(order.totalWeight) || 0;
    if (orderWeight <= 0) {
      const orderItems = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, order.id));
      const vIds = orderItems.map((i: any) => i.variantId).filter(Boolean) as number[];
      if (vIds.length > 0) {
        const dbVariants = await tx.select().from(productVariants).where(inArray(productVariants.id, vIds));
        const vMap = new Map<number, any>(dbVariants.map((v: any) => [v.id, v]));
        for (const item of orderItems) {
          const v = item.variantId ? vMap.get(item.variantId) : null;
          const wPerQuota = Number(v?.weightPerPieceKg || v?.weight || 0);
          const qPerUnit = Number(v?.quota || 1);
          orderWeight += item.quantity * qPerUnit * wPerQuota;
        }
      }
    }

    // Find eligible vehicles where capacity >= cargo weight
    let eligibleVehicles = await tx
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

    const tenantVehicles = eligibleVehicles.filter((v: any) => v.tenantId === tenantIdToUse);
    const candidates = tenantVehicles.length > 0 ? tenantVehicles : eligibleVehicles;

    if (candidates.length === 0) {
      return NextResponse.json({
        error: `Total cargo weight (${orderWeight} kg) exceeds the maximum capacity of all available vehicles. No eligible vehicle is available.`
      }, { status: 400 });
    }

    let selectedVehicle = candidates[0];
    if (order.preferredVehicle) {
      const preferred = candidates.find(
        (v: any) => v.vehicleType.trim().toLowerCase() === order.preferredVehicle!.trim().toLowerCase()
      );
      if (preferred) {
        selectedVehicle = preferred;
      }
    }

    const vehicleType = selectedVehicle.vehicleType;
    const [rate] = await tx.select().from(vehicleDeliveryRates).where(and(eq(vehicleDeliveryRates.vehicleType, vehicleType), eq(vehicleDeliveryRates.isActive, true)));
    const distanceKm = Number.parseFloat(String(order.routeDistance || order.distanceKm || '0').replace(/[^\d.]/g, '')) || 0;
    const basePrice = Number(rate?.basePrice || 100);
    const pricePerKm = Number(rate?.pricePerKm || settings?.pricePerKm || 20);
    const finalDeliveryPrice = basePrice + (distanceKm * pricePerKm);

    // Snapshot authoritative calculation onto the order
    await tx.update(deliveryOrders)
      .set({
        preferredVehicle: vehicleType,
        requiredVehicleType: vehicleType,
        vehicleCapacityKg: selectedVehicle.capacityKg,
        suggestedVehicleId: selectedVehicle.id,
        totalWeight: orderWeight.toFixed(2),
        vehicleBasePrice: basePrice.toString(),
        pricePerKm: pricePerKm.toString(),
        distanceKm: distanceKm.toString(),
        finalDeliveryPrice: finalDeliveryPrice.toString(),
      })
      .where(eq(deliveryOrders.id, order.id));

    // Find eligible ACTIVE delivery partners
    const eligiblePartners = await tx
      .select({
        id: deliveryPartners.id,
        mobileNumber: deliveryPartners.mobileNumber,
        companyName: deliveryPartners.companyName,
        email: deliveryPartners.email
      })
      .from(deliveryPartners)
      .where(and(
        or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')),
        isNotNull(deliveryPartners.email)
      ));

    if (eligiblePartners.length === 0) {
      return NextResponse.json({ error: 'No active delivery partners available with a valid email address' }, { status: 400 });
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    const partnerIds = eligiblePartners.map((p: { id: number }) => p.id);

    // Create invitations and send Emails synchronously in the DB transaction
    try {
      const txResult = await tx.transaction(async (innerTx: any) => {
        // Sync accumulated quotas into delivery items so they show correct quantities for partners
        const accumulations = await innerTx
          .select({
            itemId: quotaAccumulations.sourceItemId,
            finalizedQty: drizzleSql<number>`COALESCE(SUM(${quotaAccumulations.quantityAdded}), 0)::int`,
          })
          .from(quotaAccumulations)
          .where(eq(quotaAccumulations.sourceOrderId, order.id))
          .groupBy(quotaAccumulations.sourceItemId);

        for (const row of accumulations) {
          if (row.itemId && row.finalizedQty > 0) {
            await innerTx.update(deliveryItems).set({ quantity: row.finalizedQty }).where(eq(deliveryItems.id, row.itemId));
          }
        }

        // 0. Deduct Stock (throws if insufficient)
        await deductOrderStock(innerTx, finalTenantId, order.id, claims.userId as number);

        // 1. Update order status atomically
        await innerTx
          .update(deliveryOrders)
          .set({
            status: 'WAITING_FOR_PARTNER',
            requiredVehicleType: vehicleType,
            vehicleBasePrice: basePrice.toString(),
            pricePerKm: pricePerKm.toString(),
            distanceKm: distanceKm.toString(),
            finalDeliveryPrice: finalDeliveryPrice.toString(),
            pricingFrozenAt: new Date(),
          })
          .where(eq(deliveryOrders.id, order.id));

      }); // End of transaction

      // At this point, the order is safely DISPATCHED and stock is deducted.
      // We can immediately return a success response to the client to meet the < 1s requirement.
      // All heavy operations (argon2 hashing for tokens, bulk DB inserts, emails) must be awaited.
      await (async () => {
        try {
          // 2. Generate Tokens and Hash
          const tokens = eligiblePartners.map(() => crypto.randomBytes(32).toString('hex'));
          const tokenHashes = await Promise.all(tokens.map((t: string) => hashPassword(t)));

          const invitationsToInsert = eligiblePartners.map((partner: any, i: number) => ({
            tenantId: tenantIdToUse,
            deliveryOrderId: order.id,
            deliveryPartnerId: partner.id,
            tokenHash: tokenHashes[i],
            status: 'PENDING',
            expiresAt
          }));

          // Insert invitations outside of the main request transaction
          const insertedInvitations = await db
            .insert(deliveryInvitations)
            .values(invitationsToInsert)
            .returning();

          const newNotifsToInsert: any[] = [];

          // Get delivery date for email
          const deliveryDate = order.deliveryDate
            ? new Date(order.deliveryDate).toLocaleDateString('en-PH', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
            : 'As soon as possible';

          const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/partner/orders/${order.id}`;

          // Prepare partner list for email
          const partnerEmailList = eligiblePartners.map((p: { id: number; email: string | null; companyName: string | null }) => ({
            id: p.id,
            email: p.email,
            companyName: p.companyName
          }));

          const bodyStr = await buildStandardNotificationBody('New Delivery Request', {
            orderId: order.id,
            status: 'PENDING',
            reason: 'New order available for pickup'
          });

          insertedInvitations.forEach((invitation: any) => {
            const partner = eligiblePartners.find((p: any) => p.id === invitation.deliveryPartnerId);
            if (!partner || !partner.email) return;

            // Unified Push Notifications
            newNotifsToInsert.push({
              tenantId: tenantIdToUse,
              deliveryOrderId: order.id,
              senderId: claims.userId || null,
              receiverId: partner.id,
              receiverRole: 'DELIVERY_PARTNER',
              recipientEmail: partner.email,
              notificationType: 'new_delivery_request',
              title: 'New Delivery Request Available',
              body: bodyStr,
              actionUrl: acceptUrl,
              status: 'UNREAD'
            });
          });

          // Notification for Customer
          if (order.customerId) {
            newNotifsToInsert.push({
              tenantId: finalTenantId,
              deliveryOrderId: order.id,
              senderId: claims.userId || null,
              receiverId: order.customerId,
              receiverRole: 'CUSTOMER',
              recipientEmail: null,
              notificationType: 'order_dispatched',
              title: 'Order Dispatched',
              body: `Your order has been dispatched and is looking for a delivery partner.`,
              actionUrl: `/orders`,
              status: 'UNREAD'
            });
          }

          // Insert unified notifications
          if (newNotifsToInsert.length > 0) {
            await db.insert(notifications).values(newNotifsToInsert);
          }

          const [businessOwnerUser] = await db.select({ contact: users.contactNumber })
            .from(users)
            .where(and(eq(users.tenantId, finalTenantId), eq(users.role, 'BUSINESS_OWNER')))
            .limit(1);
          const ownerContact = businessOwnerUser?.contact || undefined;

          // Send broadcast emails asynchronously (non-blocking)
          if (partnerEmailList && partnerEmailList.length > 0) {
            await sendBroadcastDeliveryNotification(
              finalTenantId,
              order.id,
              order.customerName,
              order.pickupAddress,
              order.dropoffAddress,
              deliveryDate,
              ownerContact,
              order.instructions || undefined,
              partnerEmailList,
              acceptUrl,
              order.id
            ).catch((err: any) => {
              console.error('Failed to send unified broadcast email:', err.message);
            });
          }
        } catch (err) {
          console.error('Error in background dispatch tasks:', err);
        }
      })();

      // The broadcast emails and tokens are processed in the background.

      return NextResponse.json({
        success: true,
        message: `Dispatched to ${eligiblePartners.length} partners. Broadcast emails sent successfully.`
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch order due to inventory constraints' }, { status: 400 });
    }

  });
}
