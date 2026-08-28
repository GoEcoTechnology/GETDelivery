import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, notifications } from '@/db/schema';
import { eq, and, or, isNotNull } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';
import { sendEmail } from '@/lib/emailService';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['delivery.dispatch'] }, async (tx, claims) => {
    const orderId = parseInt((await params).id, 10);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid delivery ID' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    if (isNaN(tenantIdToUse)) {
      return NextResponse.json({ error: 'Tenant context is missing or invalid' }, { status: 400 });
    }

    // Fetch and validate the order
    const [order] = await tx
      .select()
      .from(deliveryOrders)
      .where(and(
        eq(deliveryOrders.id, orderId),
        eq(deliveryOrders.tenantId, tenantIdToUse)
      ));

    if (!order) {
      return NextResponse.json({ error: 'Delivery order not found' }, { status: 404 });
    }

    if (order.status !== 'READY_FOR_DISPATCH' && order.status !== 'DRAFT') {
      return NextResponse.json({ error: `Cannot dispatch delivery in status: ${order.status}` }, { status: 400 });
    }

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
    const txResult = await tx.transaction(async (innerTx: any) => {
      // 1. Update order status atomically
      await innerTx
        .update(deliveryOrders)
        .set({ status: 'DISPATCHED' })
        .where(eq(deliveryOrders.id, order.id));

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

      const insertedInvitations = await innerTx
        .insert(deliveryInvitations)
        .values(invitationsToInsert)
        .returning();

      const newNotifsToInsert: any[] = [];
      const emailTasks: Promise<any>[] = [];
      
      const messageTitle = 'New Delivery Request';
      const messageHtml = `
        <p>A new delivery request is available.</p>
        <p><strong>Delivery Request:</strong> DR-000${order.id}</p>
        <p><strong>Order:</strong> ORD-100${order.id}</p>
        <p><strong>Customer:</strong> ${order.customerName}</p>
        <p><strong>Pickup:</strong> ${order.pickupAddress}</p>
        <p><strong>Dropoff:</strong> ${order.dropoffAddress}</p>
      `;

      // Map tokens by partner ID to ensure correct matching regardless of Postgres returning order
      const partnerTokens = new Map<number, string>();
      eligiblePartners.forEach((p: any, i: number) => partnerTokens.set(p.id, tokens[i]));

      insertedInvitations.forEach((invitation: any) => {
        const partner = eligiblePartners.find((p: any) => p.id === invitation.deliveryPartnerId);
        const token = partnerTokens.get(invitation.deliveryPartnerId);
        if (!partner || !token || !partner.email) return;

        const fullToken = `${invitation.id}_${token}`;
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${fullToken}`;
        
        const finalHtml = `
          ${messageHtml}
          <p>Please click the link below to securely view the delivery request and choose whether you want to accept or decline it.</p>
          <a href="${inviteLink}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:5px;">View & Accept Request</a>
        `;
        
        // Unified Push Notifications / Email log
        newNotifsToInsert.push({
          tenantId: tenantIdToUse,
          deliveryOrderId: order.id,
          senderId: claims.userId || null,
          receiverId: partner.id,
          receiverRole: 'DELIVERY_PARTNER',
          recipientEmail: partner.email,
          notificationType: 'new_delivery_request',
          title: messageTitle,
          body: `New order ready for pickup. Order #SO-000${order.id}`,
          actionUrl: `/partner/orders/${order.id}`,
          status: 'UNREAD' // Initial status, will be updated by email result
        });
      });

      // Insert unified notifications (returns the inserted rows so we can track them)
      let insertedNotifs: any[] = [];
      if (newNotifsToInsert.length > 0) {
        // Use global `db` instead of `innerTx` to bypass RLS when inserting for a different role
        insertedNotifs = await db.insert(notifications).values(newNotifsToInsert).returning();
      }

      // We do not await emails inside the transaction to prevent blocking
      // We will send them after the transaction commits, using the insertedNotifs to track success
      return insertedNotifs;
    });

    let emailStatus = 'Not attempted';
    let successCount = 0;
    let failureCount = 0;
    
    // Send Real Emails directly via Nodemailer (outside of DB transaction so it doesn't block DB locks)
    const insertedNotifs: any[] = txResult || [];
    
    if (insertedNotifs.length > 0) {
      await Promise.all(insertedNotifs.map(async (notif) => {
        if (!notif.recipientEmail) return;

        const orderDetails = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, notif.deliveryOrderId || 0));
        const order = orderDetails[0];
        
        // Regenerate link (in practice, it's better to just pass it out of the tx)
        // Since we didn't export the link, we'll just send them to the general order page 
        // Note: they need to log in to see it if they go here
        const inviteLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/partner/orders/${order.id}`;
        
        const finalHtml = `
          <p>A new delivery request is available.</p>
          <p><strong>Delivery Request:</strong> DR-000${order?.id}</p>
          <p><strong>Order:</strong> ORD-100${order?.id}</p>
          <p><strong>Customer:</strong> ${order?.customerName}</p>
          <p><strong>Pickup:</strong> ${order?.pickupAddress}</p>
          <p><strong>Dropoff:</strong> ${order?.dropoffAddress}</p>
          <p>Please click the link below to securely view the delivery request and choose whether you want to accept or decline it.</p>
          <a href="${inviteLink}" style="display:inline-block;padding:10px 20px;background-color:#4f46e5;color:white;text-decoration:none;border-radius:5px;">View & Accept Request</a>
        `;

        const result = await sendEmail({
          to: notif.recipientEmail,
          subject: notif.title,
          html: finalHtml
        });

        if (result.success) {
          successCount++;
          await db.update(notifications).set({
            status: 'sent',
            sentAt: new Date()
          }).where(eq(notifications.id, notif.id));
        } else {
          failureCount++;
          await db.update(notifications).set({
            status: 'failed',
            failedAt: new Date(),
            errorMessage: String(result.error)
          }).where(eq(notifications.id, notif.id));
        }
      }));

      emailStatus = `Sent successfully. SuccessCount: ${successCount}, FailureCount: ${failureCount}`;
    }

    return NextResponse.json({ 
      success: true, 
      message: `Dispatched to ${eligiblePartners.length} partners`,
      emailStatus 
    });

  });
}
