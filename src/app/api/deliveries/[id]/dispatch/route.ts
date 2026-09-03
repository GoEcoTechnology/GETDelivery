import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryPartners, deliveryInvitations, notifications, platformDeliverySettings, vehicleDeliveryRates } from '@/db/schema';
import { eq, and, or, isNotNull, desc } from 'drizzle-orm';
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

    if (order.status !== 'READY_FOR_DISPATCH') {
      return NextResponse.json({ error: `Only READY_FOR_DISPATCH orders can be dispatched. Current status: ${order.status}` }, { status: 400 });
    }

    const [settings] = await tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);
    const vehicleType = order.preferredVehicle || 'Motorcycle';
    const [rate] = await tx.select().from(vehicleDeliveryRates).where(and(eq(vehicleDeliveryRates.vehicleType, vehicleType), eq(vehicleDeliveryRates.isActive, true)));
    const distanceKm = Number.parseFloat(String(order.routeDistance || '0').replace(/[^\d.]/g, '')) || 0;
    const basePrice = Number(rate?.basePrice || 0);
    const pricePerKm = Number(settings?.pricePerKm || 0);
    const finalDeliveryPrice = basePrice + (distanceKm * pricePerKm);

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
        // 0. Deduct Stock (throws if insufficient)
        await deductOrderStock(innerTx, tenantIdToUse, order.id, claims.userId as number);

        // 1. Update order status atomically
        await innerTx
          .update(deliveryOrders)
          .set({
            status: 'DISPATCHED',
            requiredVehicleType: vehicleType,
            vehicleBasePrice: basePrice.toString(),
            pricePerKm: pricePerKm.toString(),
            distanceKm: distanceKm.toString(),
            finalDeliveryPrice: finalDeliveryPrice.toString(),
            pricingFrozenAt: new Date(),
          })
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
      
      // Get delivery date for email
      const deliveryDate = order.deliveryDate
        ? new Date(order.deliveryDate).toLocaleDateString('en-PH', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'As soon as possible';

      const acceptUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/partner/orders/${order.id}`;

      // Prepare partner list for email
      const partnerEmailList = eligiblePartners.map((p: { id: number; email: string | null; companyName: string | null }) => ({
        id: p.id,
        email: p.email,
        companyName: p.companyName
      }));

      // Map tokens by partner ID to ensure correct matching regardless of Postgres returning order
      const partnerTokens = new Map<number, string>();
      eligiblePartners.forEach((p: any, i: number) => partnerTokens.set(p.id, tokens[i]));

      const bodyStr = await buildStandardNotificationBody('New Delivery Request', {
        orderId: order.id,
        status: 'PENDING',
        reason: 'New order available for pickup'
      });

      insertedInvitations.forEach((invitation: any) => {
        const partner = eligiblePartners.find((p: any) => p.id === invitation.deliveryPartnerId);
        if (!partner || !partner.email) return;

        // Unified Push Notifications / Email log
        newNotifsToInsert.push({
          tenantId: tenantIdToUse,
          deliveryOrderId: order.id,
          senderId: claims.userId || null,
          receiverId: partner.id,
          receiverRole: 'DELIVERY_PARTNER',
          recipientEmail: partner.email,
          notificationType: 'new_delivery_request',
          title: 'New Delivery Request',
          body: bodyStr,
          actionUrl: acceptUrl,
          status: 'UNREAD'
        });
      });

      // Insert unified notifications (returns the inserted rows so we can track them)
      let insertedNotifs: any[] = [];
      if (newNotifsToInsert.length > 0) {
        insertedNotifs = await innerTx.insert(notifications).values(newNotifsToInsert).returning();
      }

      // Send emails asynchronously (fire-and-forget after DB commit)
      return { insertedNotifs, partnerEmailList, deliveryDate, acceptUrl };
    });

    const { insertedNotifs, partnerEmailList, deliveryDate, acceptUrl } = txResult || {};

    // Send broadcast emails asynchronously (non-blocking)
    if (partnerEmailList && partnerEmailList.length > 0) {
      sendBroadcastDeliveryNotification(
        tenantIdToUse,
        order.id,
        order.customerName,
        order.pickupAddress,
        order.dropoffAddress,
        deliveryDate,
        order.customerContact,
        order.instructions || undefined,
        partnerEmailList,
        acceptUrl,
        order.id
      ).catch(err => {
        console.error('Failed to send broadcast email:', err.message);
      });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Dispatched to ${eligiblePartners.length} partners. Broadcast emails sent successfully.`
    });
    } catch (error: any) {
      return NextResponse.json({ error: error.message || 'Failed to dispatch order due to inventory constraints' }, { status: 400 });
    }

  });
}
