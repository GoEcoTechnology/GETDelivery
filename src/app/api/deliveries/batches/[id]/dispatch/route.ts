import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems, deliveryPartners, deliveryInvitations, notifications, platformDeliverySettings, vehicleDeliveryRates, users } from '@/db/schema';
import { eq, and, or, isNotNull, desc, inArray, gte, ilike } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { deductOrderStock } from '@/lib/inventory-helper';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';
import { sendBroadcastDeliveryNotification } from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const batchId = parseInt((await params).id, 10);
    
    if (isNaN(batchId)) {
      return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 });
    }
    let body = {};
    try {
      body = await request.json();
    } catch (e) {
      // Body might be empty
    }
    const { requiredVehicleType } = body as any;

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    if (isNaN(tenantIdToUse)) {
      return NextResponse.json({ error: 'Tenant context is missing or invalid' }, { status: 400 });
    }

    // Fetch and validate the batch
    const [batch] = await tx
      .select()
      .from(deliveryBatches)
      .where(and(
        eq(deliveryBatches.id, batchId),
        eq(deliveryBatches.tenantId, tenantIdToUse)
      ));

    if (!batch) {
      return NextResponse.json({ error: 'Delivery batch not found' }, { status: 404 });
    }

    if (batch.status !== 'READY_FOR_DELIVERY' && batch.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch batch in current status: ${batch.status}` }, { status: 400 });
    }

    // Get all orders in this batch
    const batchItems = await tx
      .select({ orderId: deliveryBatchItems.customerOrderId })
      .from(deliveryBatchItems)
      .where(eq(deliveryBatchItems.batchId, batchId));

    if (batchItems.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch (batchItems empty)' }, { status: 400 });
    }
    
    const orderIds = batchItems.map((item: any) => item.orderId);

    const ordersInBatch = await tx
      .select()
      .from(deliveryOrders)
      .where(inArray(deliveryOrders.id, orderIds));

    if (ordersInBatch.length === 0) {
      return NextResponse.json({ error: 'No orders found in this batch' }, { status: 400 });
    }

    const [settings] = await tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);
    
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

    try {
      await tx.transaction(async (innerTx: any) => {
        // 0. Deduct Stock for all orders in batch
        for (const order of ordersInBatch) {
          await deductOrderStock(innerTx, tenantIdToUse, order.id, claims.userId as number);
        }

        // Determine the vehicle and pricing
        let finalVehicleType = requiredVehicleType || 'Motorcycle';
        let basePrice = 0;
        let pricePerKm = 0;

        const [rate] = await innerTx
          .select()
          .from(vehicleDeliveryRates)
          .where(ilike(vehicleDeliveryRates.vehicleType, finalVehicleType))
          .limit(1);

        if (rate) {
          basePrice = Number(rate.basePrice) || 0;
          pricePerKm = Number(rate.pricePerKm) || 0;
        } else if (settings) {
          pricePerKm = Number(settings.pricePerKm) || 0;
        }

        // 1. Update all order statuses and pricing
        for (const order of ordersInBatch) {
          const distanceKm = Number.parseFloat(String(order.routeDistance || order.distanceKm || '0').replace(/[^\d.]/g, '')) || 0;
          
          let finalBasePrice = basePrice;
          let finalPricePerKm = pricePerKm;
          
          if (finalBasePrice === 0) {
            finalBasePrice = Number(order.vehicleBasePrice) || (order.normalDeliveryFee ? Number(order.normalDeliveryFee) : 50);
          }
          if (finalPricePerKm === 0) {
            finalPricePerKm = Number(order.pricePerKm) || 10;
          }
          
          const finalDeliveryPrice = finalBasePrice + (distanceKm * finalPricePerKm);
          
          await innerTx
            .update(deliveryOrders)
            .set({
              status: 'WAITING_FOR_PARTNER',
              pricingFrozenAt: new Date(),
              vehicleBasePrice: finalBasePrice.toString(),
              pricePerKm: finalPricePerKm.toString(),
              distanceKm: distanceKm.toString(),
              finalDeliveryPrice: finalDeliveryPrice.toString(),
              requiredVehicleType: finalVehicleType,
              preferredVehicle: finalVehicleType,
            })
            .where(eq(deliveryOrders.id, order.id));
        }

        // 2. Mark batch as WAITING_FOR_PARTNER
        await innerTx
          .update(deliveryBatches)
          .set({ 
            status: 'WAITING_FOR_PARTNER'
          })
          .where(eq(deliveryBatches.id, batchId));
      }); // End of transaction

      // Background tasks
      (async () => {
        try {
          const invitationsToInsert = [];
          
          // Only create invitations for the FIRST order in the batch to avoid duplicate UI cards
          // The single parent order will represent the entire batch.
          const firstOrder = ordersInBatch[0];
          
          const tokens = eligiblePartners.map(() => crypto.randomBytes(32).toString('hex'));
          const tokenHashes = await Promise.all(tokens.map((t: string) => hashPassword(t)));

          const orderInvitations = eligiblePartners.map((partner: any, i: number) => ({
            tenantId: tenantIdToUse,
            deliveryOrderId: firstOrder.id, // Only use firstOrder.id
            deliveryPartnerId: partner.id,
            tokenHash: tokenHashes[i],
            status: 'PENDING',
            expiresAt
          }));
          
          invitationsToInsert.push(...orderInvitations);

          if (invitationsToInsert.length > 0) {
            await db.insert(deliveryInvitations).values(invitationsToInsert);
          }

          // Send 1 broadcast email per partner using the first order in the batch
          const deliveryDate = firstOrder.deliveryDate
            ? new Date(firstOrder.deliveryDate).toLocaleDateString('en-PH', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : 'As soon as possible';

          const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')}/partner/orders/${firstOrder.id}`;

          const partnerEmailList = eligiblePartners.map((p: { id: number; email: string | null; companyName: string | null }) => ({
            id: p.id,
            email: p.email,
            companyName: p.companyName
          }));

          const bodyStr = await buildStandardNotificationBody('New Batch Delivery Request', {
            orderId: firstOrder.id,
            status: 'PENDING',
            reason: `New batch of ${ordersInBatch.length} orders available for pickup`
          });

          const newNotifsToInsert: any[] = [];
          for (const partner of eligiblePartners) {
            if (!partner.email) continue;
            newNotifsToInsert.push({
              tenantId: tenantIdToUse,
              deliveryOrderId: firstOrder.id, // attach notif to first order
              senderId: claims.userId || null,
              receiverId: partner.id,
              receiverRole: 'DELIVERY_PARTNER',
              recipientEmail: partner.email,
              notificationType: 'new_delivery_request',
              title: 'New Batch Delivery Request Available',
              body: bodyStr,
              actionUrl: acceptUrl,
              status: 'UNREAD'
            });
          }

          // Notifications for Customers
          for (const order of ordersInBatch) {
            if (order.customerId) {
              newNotifsToInsert.push({
                tenantId: tenantIdToUse,
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
          }

          if (newNotifsToInsert.length > 0) {
            await db.insert(notifications).values(newNotifsToInsert);
          }

          const [businessOwnerUser] = await db.select({ contact: users.contactNumber })
            .from(users)
            .where(and(eq(users.tenantId, tenantIdToUse), eq(users.role, 'BUSINESS_OWNER')))
            .limit(1);
          const ownerContact = businessOwnerUser?.contact || undefined;
          const dropoffAddr = ordersInBatch.length > 1 ? 'Multiple Drop Offs' : firstOrder.dropoffAddress;

          if (partnerEmailList && partnerEmailList.length > 0) {
            await sendBroadcastDeliveryNotification(
              tenantIdToUse,
              firstOrder.id,
              firstOrder.customerName, // Removed in template, but still part of function signature
              firstOrder.pickupAddress,
              dropoffAddr,
              deliveryDate,
              ownerContact,
              firstOrder.instructions || undefined,
              partnerEmailList,
              acceptUrl,
              firstOrder.id
            ).catch((err: any) => {
              console.error('Failed to send unified broadcast email:', err.message);
            });
          }
        } catch (err) {
          console.error('Error in background dispatch tasks:', err);
        }
      })();

      return NextResponse.json({ 
        success: true, 
        message: `Batch dispatched to ${eligiblePartners.length} partners. Broadcast emails sent successfully.`
      });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch batch due to inventory constraints' }, { status: 400 });
    }
  });
}
