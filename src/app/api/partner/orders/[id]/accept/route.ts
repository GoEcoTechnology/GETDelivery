import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryInvitations, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and, isNull, inArray, ne } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { sendEmail } from '@/lib/emailService';
import { users } from '@/db/schema';
import { 
  sendPartnerAcceptedNotification
} from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      const [existingOrder] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));
      if (!existingOrder) {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }

      // If it's part of a batch, get all order IDs
      let relatedOrderIds = [orderId];
      if (existingOrder.batchId) {
        const { deliveryBatchItems } = await import('@/db/schema');
        const bItems = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, existingOrder.batchId));
        if (bItems.length > 0) {
          relatedOrderIds = bItems.map((item: any) => item.customerOrderId);
        }
      }

      // Verify invitation first using admin DB connection
      const [invitation] = await db.select().from(deliveryInvitations).where(
        and(
          eq(deliveryInvitations.deliveryOrderId, orderId),
          eq(deliveryInvitations.deliveryPartnerId, partnerId),
          eq(deliveryInvitations.status, 'PENDING')
        )
      );

      if (!invitation) {
        if (existingOrder.temporaryWinnerId === partnerId) {
          return NextResponse.json({ success: true, message: 'You have already accepted this request.' });
        }
        return NextResponse.json({ 
          error: `Could not accept this delivery. It may have expired or been assigned to another partner.` 
        }, { status: 400 });
      }

      // Perform updates using admin connection to bypass RLS restrictions on deliveryOrders for partners
      const updatedOrders = await db
        .update(deliveryOrders)
        .set({
          status: 'ACCEPTED',
          temporaryWinnerId: partnerId,
          acceptedAt: new Date()
        })
        .where(
          and(
            inArray(deliveryOrders.id, relatedOrderIds),
            eq(deliveryOrders.status, 'WAITING_FOR_PARTNER'),
            isNull(deliveryOrders.temporaryWinnerId)
          )
        )
        .returning();

      if (updatedOrders.length === 0) {
        return NextResponse.json({ error: 'Failed to accept. Order may no longer be available.' }, { status: 409 });
      }

      if (existingOrder.batchId) {
        const { deliveryBatches } = await import('@/db/schema');
        await db.update(deliveryBatches)
          .set({ status: 'ACCEPTED' })
          .where(eq(deliveryBatches.id, existingOrder.batchId));
      }

      // Fire and forget all other operations to ensure a lightning fast response to the client
      (async () => {
        try {
          // Mark the invitation for this partner as ACCEPTED for ALL orders in batch
          await db
            .update(deliveryInvitations)
            .set({ status: 'ACCEPTED', respondedAt: new Date() })
            .where(
              and(
                inArray(deliveryInvitations.deliveryOrderId, relatedOrderIds),
                eq(deliveryInvitations.deliveryPartnerId, partnerId)
              )
            ).returning();

          // Expire ALL other pending invitations for these orders instantly
          await db
            .update(deliveryInvitations)
            .set({ status: 'EXPIRED', respondedAt: new Date() })
            .where(
              and(
                inArray(deliveryInvitations.deliveryOrderId, relatedOrderIds),
                eq(deliveryInvitations.status, 'PENDING'),
                ne(deliveryInvitations.deliveryPartnerId, partnerId) 
              )
            );

          const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
          const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

          const bodyStr = await buildStandardNotificationBody('Partner Accepted Request', {
            orderId: orderId,
            status: 'ASSIGNED',
            reason: 'A partner has claimed the delivery request. The delivery is now active.'
          });

          // Insert Unified Notification
          if (updatedOrders[0]?.tenantId) {
            await db.insert(notifications).values({
              tenantId: updatedOrders[0].tenantId,
              deliveryOrderId: orderId,
              senderId: partnerId,
              receiverId: 0, 
              receiverRole: 'BUSINESS_OWNER',
              notificationType: 'order_accepted',
              title: 'Partner Accepted Request',
              body: bodyStr,
              actionUrl: `/admin/deliveries/${orderId}`,
              status: 'UNREAD'
            });
          }

          // Audit log for all orders
          for (const oId of relatedOrderIds) {
            await db.insert(auditLogs).values({
              tenantId: updatedOrders[0].tenantId,
              actorType: 'PARTNER',
              actorId: partnerId,
              action: 'DELIVERY_REQUEST_ACCEPTED',
              entityType: 'DELIVERY_ORDER',
              entityId: oId,
              details: 'Partner accepted the delivery request and was assigned immediately.'
            });
          }

          // Send emails asynchronously (fire-and-forget)
          const dashboardUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph'}/admin/deliveries/${orderId}`;
          
          let totalFee = 0;
          for (const ord of updatedOrders) {
            totalFee += Number(ord.finalDeliveryPrice || 0);
          }

          sendPartnerAcceptedNotification(
            updatedOrders[0].tenantId,
            orderId,
            partnerName,
            partner?.mobileNumber,
            undefined, // vehicleDetails not fetched yet, optional
            relatedOrderIds.length,
            totalFee,
            updatedOrders[0].pickupAddress || existingOrder.pickupAddress,
            undefined,
            dashboardUrl,
            orderId
          ).catch(err => {
            console.error('Failed to send partner accepted notification:', err.message);
          });
        } catch (e) {
          console.error('Error in background tasks for accept order:', e);
        }
      })();

      return NextResponse.json({ success: true, message: 'Delivery request accepted and assigned successfully.' });
  });
}
