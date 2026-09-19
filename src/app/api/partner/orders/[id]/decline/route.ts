import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, auditLogs, notifications, deliveryPartners } from '@/db/schema';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { sendEmail } from '@/lib/emailService';
import { users } from '@/db/schema';
import { sendPartnerDeclinedNotification } from '@/lib/emailWorkflowHelper';
import { buildStandardNotificationBody } from '@/lib/notificationHelper';

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

      // Audit log (keeps internal record)
      await db.insert(auditLogs).values({
        tenantId: updatedInvitation.tenantId,
        actorType: 'PARTNER',
        actorId: partnerId,
        action: 'DELIVERY_REQUEST_DECLINED',
        entityType: 'DELIVERY_ORDER',
        entityId: orderId,
        details: `Partner declined the request. Reason: ${declineReason || 'Not specified'}`
      });

      // No emails or in-app notifications are sent to the Business Owner here,
      // as they should only be notified upon successful acceptance or completion.
      // The order remains in DISPATCHED status.

      return NextResponse.json({ success: true, message: 'Delivery request declined.' });

    } catch (error) {
      console.error('Error declining delivery:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
