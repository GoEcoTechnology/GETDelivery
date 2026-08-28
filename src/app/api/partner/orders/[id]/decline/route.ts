import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { sendEmail } from '@/lib/emailService';
import { users } from '@/db/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['partner.access'] }, async (tx, claims) => {
    try {
      const orderId = parseInt((await params).id, 10);
      const partnerId = claims.partnerId as number;
      const { declineReason } = await request.json();

      if (isNaN(orderId)) {
        return NextResponse.json({ error: 'Invalid delivery order ID' }, { status: 400 });
      }

      // Mark the invitation as DECLINED using admin connection to bypass RLS
      const [updatedInvitation] = await db
        .update(deliveryInvitations)
        .set({
          status: 'DECLINED',
          declineReason: declineReason || 'Other',
          respondedAt: new Date()
        })
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.deliveryPartnerId, partnerId),
            eq(deliveryInvitations.status, 'PENDING') // Only if it's currently pending
          )
        )
        .returning();

      if (!updatedInvitation) {
        return NextResponse.json({ error: 'Cannot decline this request. It may have expired or you already responded.' }, { status: 400 });
      }

      // Check if there are any pending invitations left for this order
      const pendingInvitations = await db
        .select()
        .from(deliveryInvitations)
        .where(
          and(
            eq(deliveryInvitations.deliveryOrderId, orderId),
            eq(deliveryInvitations.status, 'PENDING')
          )
        );

      if (pendingInvitations.length === 0) {
        // If no pending invitations remain, revert the order status to READY_FOR_DISPATCH
        await db
          .update(deliveryOrders)
          .set({ status: 'READY_FOR_DISPATCH' })
          .where(eq(deliveryOrders.id, orderId));
      }

      const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
      const partnerName = partner?.companyName || partner?.contactPerson || 'A delivery partner';

      const messageTitle = 'Delivery Request Declined';
      const messageBody = `${partnerName} declined your delivery request.\nReason: ${declineReason || 'Not specified'}`;

      // Insert Unified Notification
      await db.insert(notifications).values({
        tenantId: updatedInvitation.tenantId,
        deliveryOrderId: orderId,
        senderId: partnerId,
        receiverId: 0, // 0 for broadcast to tenant
        receiverRole: 'PLATFORM_OWNER',
        notificationType: 'order_declined',
        title: messageTitle,
        body: messageBody,
        actionUrl: `/admin/deliveries/${orderId}`,
        status: 'UNREAD'
      });


      // Audit log
      await db.insert(auditLogs).values({
        tenantId: updatedInvitation.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_DECLINED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner declined the request. Reason: ${declineReason || 'Not specified'}`
      });

      // Send Real Email Notification to Tenant Users
      try {
        const tenantUsers = await db
          .select({ email: users.email })
          .from(users)
          .where(
            and(
              eq(users.tenantId, updatedInvitation.tenantId),
              inArray(users.role, ['PLATFORM_OWNER', 'BUSINESS_OWNER', 'EMPLOYEE'])
            )
          );

        const emailAddresses = tenantUsers.map(u => u.email).filter(Boolean);

        if (emailAddresses.length > 0) {
          const actionUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/admin/deliveries/${orderId}`;
          const finalHtml = `
            <p>A delivery partner has declined your delivery request.</p>
            <p><strong>Delivery Request:</strong> DR-000${orderId}</p>
            <p><strong>Delivery Partner:</strong> ${partnerName}</p>
            <p><strong>Reason:</strong> ${declineReason || 'Not specified'}</p>
            <p><a href="${actionUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:5px;">View Order</a></p>
          `;

          await Promise.all(emailAddresses.map(email => 
            sendEmail({
              to: email,
              subject: 'Delivery Request Declined',
              html: finalHtml
            })
          ));
        }

        // Now notify remaining eligible partners if any via Email
        if (pendingInvitations.length > 0) {
          const remainingPartnerIds = pendingInvitations.map(inv => inv.deliveryPartnerId);
          
          const remainingPartners = await db
            .select({ id: deliveryPartners.id, email: deliveryPartners.email })
            .from(deliveryPartners)
            .where(
              and(
                inArray(deliveryPartners.id, remainingPartnerIds),
                isNotNull(deliveryPartners.email)
              )
            );

          if (remainingPartners.length > 0) {
            const partnerActionUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/partner/orders/${orderId}`;
            const partnerHtml = `
              <p>A delivery request is still waiting for a partner.</p>
              <p><strong>Order:</strong> #SO-000${orderId}</p>
              <p>Tap below to securely view the delivery request and choose whether you want to accept or decline it before it's gone!</p>
              <p><a href="${partnerActionUrl}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:5px;">View & Accept Request</a></p>
            `;

            await Promise.all(remainingPartners.map(p => 
              p.email ? sendEmail({
                to: p.email,
                subject: 'Delivery Request Update',
                html: partnerHtml
              }) : Promise.resolve()
            ));
          }
        }

      } catch (emailError) {
        console.error('Failed to send email on decline:', emailError);
      }

      return NextResponse.json({ success: true, message: 'Delivery request declined.' });

    } catch (error) {
      console.error('Error declining delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
