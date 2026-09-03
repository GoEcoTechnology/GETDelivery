import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, notifications, deliveryPartners, tenants } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';
import { sendEmail } from '@/lib/emailService';
import * as emailTemplates from '@/lib/emailTemplates';
import { sendEmailToTenantUsers } from '@/lib/emailWorkflowHelper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
    try {
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;
      const { cancelReason } = await request.json();

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Check if order is assigned to this partner
      const [order] = await db.select().from(deliveryOrders).where(
        and(
          eq(deliveryOrders.id, orderId),
          eq(deliveryOrders.temporaryWinnerId, partnerId)
        )
      );

      if (!order) {
        return NextResponse.json({ error: 'Order not found or not assigned to you.' }, { status: 404 });
      }

      // 1. Update order status back to DISPATCHED
      await db.update(deliveryOrders)
        .set({ status: 'DISPATCHED', temporaryWinnerId: null })
        .where(eq(deliveryOrders.id, orderId));

      // 2. Mark this partner's invitation as CANCELLED
      await db.update(deliveryInvitations)
        .set({ status: 'CANCELLED', declineReason: cancelReason || 'Cancelled by partner', respondedAt: new Date() })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, partnerId)
          )
        );

      // 3. (Removed the query that just reactivated EXPIRED invitations. 
      // We will re-generate invitations for all eligible partners below.)

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId));
      const businessName = tenant?.name || 'Business Owner';

      // 4. Notify Business Owner
      const tenantMsgTitle = 'Assigned Delivery Cancelled';
      const tenantMsgBody = await buildStandardNotificationBody(tenantMsgTitle, {
        orderId: orderId,
        status: 'CANCELLED',
        reason: cancelReason || 'None provided'
      });
      
      await db.insert(notifications).values({
        tenantId: order.tenantId,
        deliveryOrderId: orderId,
        senderId: partnerId,
        receiverId: 0,
        receiverRole: 'PLATFORM_OWNER',
        notificationType: 'order_declined',
        title: tenantMsgTitle,
        body: tenantMsgBody,
        actionUrl: `/admin/deliveries/${orderId}`,
        status: 'UNREAD'
      });

      // Send email to business owner and employees via the workflow helper
      sendEmailToTenantUsers(
        order.tenantId,
        tenantMsgTitle,
        emailTemplates.orderDeclinedTemplate({
          businessName,
          partnerName: partnerName,
          orderId: orderId,
          reason: cancelReason || 'None provided',
          dashboardUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph'}/admin/deliveries/${orderId}`,
        })
      ).catch(err => console.error('Failed to send cancellation email to owner:', err));

      // 5. Notify All Active & Eligible Partners (Except the cancelling one)
      // Query all eligible partners dynamically to ensure we don't skip newly registered ones
      const eligiblePartners = await db
        .select({ 
          id: deliveryPartners.id, 
          email: deliveryPartners.email
        })
        .from(deliveryPartners)
        .where(and(
          or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')),
          isNotNull(deliveryPartners.email),
          ne(deliveryPartners.id, partnerId)
        ));

      // Execute the email and notification logic asynchronously to avoid blocking the response
      Promise.resolve().then(async () => {
        try {
          const pBody = await buildStandardNotificationBody('Order Available Again', {
            orderId: orderId,
            status: 'PENDING',
            reason: `Order from "${businessName}" was cancelled by the previous Delivery Partner.`
          });

          const notificationsToInsert = eligiblePartners.map((dp: any) => ({
            tenantId: order.tenantId,
            deliveryOrderId: orderId,
            senderId: 0,
            receiverId: dp.id,
            receiverRole: 'DELIVERY_PARTNER',
            notificationType: 'new_delivery_request',
            title: 'Order Available Again',
            body: pBody,
            actionUrl: `/partner/orders/${orderId}`,
            status: 'UNREAD'
          }));

          // Insert notifications in bulk
          if (notificationsToInsert.length > 0) {
            await db.insert(notifications).values(notificationsToInsert);
          }

          // Reactivate invitations for existing EXPIRED ones, and insert new PENDING for missing ones
          // To simplify, we can just update all existing to PENDING, and the ones missing will just receive the email. 
          // If they click the link, they can still view it if the system allows, or we can insert if missing.
          await db.update(deliveryInvitations)
            .set({ status: 'PENDING', respondedAt: null })
            .where(
              and(
                eq(deliveryInvitations.deliveryOrderId, orderId),
                eq(deliveryInvitations.status, 'EXPIRED'),
                ne(deliveryInvitations.deliveryPartnerId, partnerId)
              )
            );
            
          // If we want to guarantee every partner has an invitation record, we can fetch existing and insert missing.
          // But to adhere strictly to not changing business logic: the previous code only updated EXPIRED to PENDING.
          // Wait, the user specifically asked "Order Available Again Not Sent to All Delivery Partners... Do not skip any registered Delivery Partner".
          const existingInvs = await db.select({ partnerId: deliveryInvitations.deliveryPartnerId })
            .from(deliveryInvitations)
            .where(eq(deliveryInvitations.deliveryOrderId, orderId));
          const existingPartnerIds = new Set(existingInvs.map(i => i.partnerId));
          
          const missingPartners = eligiblePartners.filter((p: any) => !existingPartnerIds.has(p.id));
          if (missingPartners.length > 0) {
            const { hashPassword } = await import('@/lib/password');
            const crypto = await import('crypto');
            
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1);
            
            const newInvitations = await Promise.all(missingPartners.map(async (p: any) => ({
              tenantId: order.tenantId,
              deliveryOrderId: orderId,
              deliveryPartnerId: p.id,
              tokenHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
              status: 'PENDING',
              expiresAt
            })));
            
            await db.insert(deliveryInvitations).values(newInvitations);
          }

          let formattedDate = 'Not specified';
          if (order.deliveryDate) {
            formattedDate = new Date(order.deliveryDate).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            });
          }

          // Send emails concurrently but without blocking
          await Promise.all(eligiblePartners.map(async (dp: any) => {
            if (dp && dp.email) {
              await sendEmail({
                to: dp.email,
                subject: 'Order Available Again',
                html: `
                  <h2 style="color:#0f172a; margin-bottom: 16px;">A delivery request is available again</h2>
                  <p style="color:#334155; margin-bottom: 12px;">Order from <strong>"${businessName}"</strong> was cancelled by the previous Delivery Partner and is now available for acceptance.</p>
                  <ul style="color:#334155; margin-bottom: 24px; padding-left: 20px;">
                    <li style="margin-bottom: 8px;"><strong>Pickup:</strong> ${order.pickupAddress}</li>
                    <li style="margin-bottom: 8px;"><strong>Destination:</strong> ${order.dropoffAddress}</li>
                    <li style="margin-bottom: 8px;"><strong>Delivery Date:</strong> ${formattedDate}</li>
                  </ul>
                  <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph'}/partner/orders/${orderId}" style="display:inline-block;padding:12px 24px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:6px;font-weight:600;">View Order Details</a>
                `,
              }).catch(err => console.error('Failed to send availability email to partner:', err));
            }
          }));
        } catch (err) {
          console.error('Error in background broadcast:', err);
        }
      });

      // 6. Audit Log
      await db.insert(auditLogs).values({
        tenantId: order.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_CANCELLED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner cancelled assignment. Reason: ${cancelReason || 'Not specified'}. Order reverted to DISPATCHED.`
      });

      return NextResponse.json({ success: true, message: 'Assignment cancelled successfully. Order is available again.' });
    } catch (error) {
      console.error('Error cancelling delivery assignment:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
