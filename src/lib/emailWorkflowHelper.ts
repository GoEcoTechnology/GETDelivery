/**
 * Email Workflow Helper
 * 
 * Coordinates email sending with in-app notification creation
 * Ensures emails and notifications are synchronized across all user types:
 * - Business Owners
 * - Employees
 * - Delivery Partners
 */

import { sendEmail, SendEmailResult } from './emailService';
import * as emailTemplates from './emailTemplates';
import * as emailTemplatesV2 from './emailTemplatesV2';
import { db } from '@/db';
import { users, notifications, tenants, deliveryOrders } from '@/db/schema';
import type { InferSelectModel } from 'drizzle-orm';
import { eq, and, inArray } from 'drizzle-orm';

export interface NotificationPayload {
  tenantId: number;
  deliveryOrderId: number;
  senderId?: number;
  senderType?: 'USER' | 'PARTNER' | 'SYSTEM';
  notificationType: string;
  title: string;
  body: string;
  actionUrl?: string;
  image?: string;
}

type NotificationRow = InferSelectModel<typeof notifications>;

/**
 * Send email to Business Owner and all Employees
 */
export async function sendEmailToTenantUsers(
  tenantId: number,
  subject: string,
  emailTemplate: { html: string; text: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get all active users (Business Owner + Employees) for this tenant
    const tenantUsers = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.tenantId, tenantId),
          inArray(users.role, ['BUSINESS_OWNER', 'EMPLOYEE']),
          eq(users.status, 'ACTIVE')
        )
      );

    if (tenantUsers.length === 0) {
      return { success: false, error: 'No active users found for this tenant' };
    }

    const emails = tenantUsers
      .map(u => u.email)
      .filter((e): e is string => e !== null && e !== undefined);

    if (emails.length === 0) {
      return { success: false, error: 'No valid email addresses found' };
    }

    // Send email to all users
    const result = await sendEmail({
      to: emails,
      subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!result.success) {
      console.error('Failed to send email to tenant users:', result.error);
      return { success: false, error: result.error };
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending email to tenant users:', message);
    return { success: false, error: message };
  }
}

/**
 * Send email to all active delivery partners
 */
export async function sendEmailToAllPartners(
  emails: { email?: string | null; id: number }[],
  subject: string,
  emailTemplate: { html: string; text: string }
): Promise<SendEmailResult> {
  try {
    const validEmails = emails
      .filter(p => p.email)
      .map(p => p.email as string);

    if (validEmails.length === 0) {
      return { success: false, error: 'No valid partner email addresses found' };
    }

    return await sendEmail({
      to: validEmails,
      subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending email to partners:', message);
    return { success: false, error: message };
  }
}

/**
 * Create notification for in-app notifications table
 * Used for tracking and real-time notification system
 */
export async function createNotification(payload: {
  tenantId: number;
  deliveryOrderId?: number;
  senderId?: number;
  receiverId?: number; // 0 for broadcast to all users with receiverRole
  receiverRole: 'BUSINESS_OWNER' | 'EMPLOYEE' | 'DELIVERY_PARTNER' | 'PLATFORM_OWNER';
  recipientEmail?: string;
  notificationType: string;
  title: string;
  body: string;
  actionUrl?: string;
  image?: string;
  status?: 'UNREAD' | 'READ' | 'ARCHIVED';
}): Promise<NotificationRow> {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        tenantId: payload.tenantId,
        deliveryOrderId: payload.deliveryOrderId || null,
        senderId: payload.senderId || null,
        receiverId: payload.receiverId || 0,
        receiverRole: payload.receiverRole,
        recipientEmail: payload.recipientEmail,
        notificationType: payload.notificationType,
        title: payload.title,
        body: payload.body,
        actionUrl: payload.actionUrl,
        image: payload.image,
        status: payload.status || 'UNREAD',
      })
      .returning();

    return notification;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error creating notification:', message);
    throw error;
  }
}

/**
 * Send email + create notification for quota reached
 * Recipients: Business Owner + All Employees
 */
export async function sendQuotaReachedNotification(
  tenantId: number,
  batchId: number,
  totalOrders: number,
  totalProducts: number,
  quota: number,
  dashboardUrl: string,
  deliveryOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate email template
    const emailTemplate = emailTemplates.quotaReachedTemplate({
      tenantName: '', // We'll get this from DB if needed
      batchId,
      totalOrders,
      totalProducts,
      quota,
      dashboardUrl,
    });

    // Send email to all tenant users
    const emailResult = await sendEmailToTenantUsers(
      tenantId,
      `✅ Quota Reached · Batch Ready for Dispatch · BATCH-${String(batchId).padStart(5, '0')}`,
      emailTemplate
    );

    if (!emailResult.success) {
      console.error('Failed to send quota reached email:', emailResult.error);
    }

    // Create in-app notification
    await createNotification({
      tenantId,
      deliveryOrderId,
      receiverRole: 'BUSINESS_OWNER',
      receiverId: 0, // Broadcast to all tenant users
      notificationType: 'quota_reached',
      title: `Quota Reached · Batch Ready`,
      body: `Your delivery batch with ${totalOrders} orders is ready for dispatch.`,
      actionUrl: dashboardUrl,
      status: 'UNREAD',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendQuotaReachedNotification:', message);
    return { success: false, error: message };
  }
}

/**
 * Send email + create notification for driver assignment (own vehicle)
 * Recipients: Assigned driver
 */
export async function sendDriverAssignmentNotification(
  tenantId: number,
  driverId: number,
  driverName: string,
  vehicleDetails: string,
  batchId: number,
  ordersCount: number,
  pickupAddress: string,
  pickupTime: string | undefined,
  dispatchUrl: string,
  deliveryOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get driver email
    const [driver] = await db
      .select()
      .from(users)
      .where(eq(users.id, driverId));

    if (!driver || !driver.email) {
      return { success: false, error: 'Driver email not found' };
    }

    // Generate email template
    const emailTemplate = emailTemplates.driverAssignmentTemplate({
      driverName,
      vehicleDetails,
      batchId,
      ordersCount,
      pickupAddress,
      pickupTime,
      dispatchUrl,
    });

    // Send email
    const emailResult = await sendEmail({
      to: driver.email,
      subject: `🚗 Delivery Assignment · BATCH-${String(batchId).padStart(5, '0')}`,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!emailResult.success) {
      console.error('Failed to send driver assignment email:', emailResult.error);
    }

    // Create in-app notification
    await createNotification({
      tenantId,
      deliveryOrderId,
      receiverId: driverId,
      receiverRole: 'EMPLOYEE',
      recipientEmail: driver.email,
      notificationType: 'driver_assignment',
      title: `🚗 Assigned to BATCH-${String(batchId).padStart(5, '0')}`,
      body: `You have been assigned delivery batch with ${ordersCount} orders.`,
      actionUrl: dispatchUrl,
      status: 'UNREAD',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendDriverAssignmentNotification:', message);
    return { success: false, error: message };
  }
}

/**
 * Send email + create notification for new broadcast delivery request
 * Recipients: All active delivery partners
 */
export async function sendBroadcastDeliveryNotification(
  tenantId: number,
  orderId: number,
  customerName: string,
  pickupAddress: string,
  dropoffAddress: string,
  deliveryDate: string,
  contactNumber: string | undefined,
  instructions: string | undefined,
  partners: { id: number; email?: string | null; companyName: string }[],
  acceptUrl: string,
  deliveryOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch tenant name for businessOwnerName
    const { tenants } = await import('@/db/schema');
    const [tenant] = await db.select({ name: tenants.name }).from(tenants).where(eq(tenants.id, tenantId));
    const businessOwnerName = tenant?.name || 'GET Delivery Customer';

    // Generate email template
    const emailTemplate = emailTemplatesV2.newDeliveryRequestTemplate({
      orderId,
      customerName,
      businessOwnerName,
      pickupAddress,
      dropoffAddress,
      deliveryDate,
      contactNumber,
      instructions,
      acceptUrl,
    });

    // Send to all partners
    const emailResult = await sendEmailToAllPartners(
      partners,
      emailTemplate.subject,
      { html: emailTemplate.html, text: emailTemplate.text }
    );

    if (!emailResult.success) {
      console.error('Failed to send broadcast email:', emailResult.error);
    }

    // Create in-app notifications for each partner
    for (const partner of partners) {
      if (partner.email) {
        await createNotification({
          tenantId,
          deliveryOrderId,
          senderId: undefined,
          receiverId: partner.id,
          receiverRole: 'DELIVERY_PARTNER',
          recipientEmail: partner.email,
          notificationType: 'new_delivery_request',
          title: `New Delivery Request Available`,
          body: `Order ORD-${String(orderId).padStart(5, '0')} for ${customerName}. Expires in 1 hour.`,
          actionUrl: acceptUrl,
          status: 'UNREAD',
        });
      }
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendBroadcastDeliveryNotification:', message);
    return { success: false, error: message };
  }
}

export async function sendPartnerAcceptedNotification(
  tenantId: number,
  orderId: number,
  partnerName: string,
  contactNumber: string | undefined,
  pickupLocation: string,
  estimatedArrival: string | undefined,
  dashboardUrl: string,
  deliveryOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch tenant and order info
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    const [order] = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, orderId));

    const businessName = tenant?.name || 'Business Owner';
    const customerName = order?.customerName || 'Customer';
    const pickupAddress = order?.pickupAddress || pickupLocation;
    const dropoffAddress = order?.dropoffAddress || 'Not specified';
    
    let deliveryDate = 'Not specified';
    if (order?.deliveryDate) {
      deliveryDate = new Date(order.deliveryDate).toLocaleDateString('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
      });
    }
    
    const acceptanceTime = new Date().toLocaleString('en-US', {
      timeZone: 'Asia/Manila',
      hour: 'numeric', minute: 'numeric', hour12: true,
      weekday: 'short', month: 'short', day: 'numeric'
    }) + ' PHT';

    // Generate email template
    const emailTemplate = emailTemplatesV2.orderAcceptedTemplate({
      businessName,
      customerName,
      orderId,
      deliveryDate,
      pickupAddress,
      dropoffAddress,
      partnerName,
      acceptanceTime,
      dashboardUrl,
    });

    // Send email to all tenant users
    const emailResult = await sendEmailToTenantUsers(
      tenantId,
      emailTemplate.subject,
      { html: emailTemplate.html, text: emailTemplate.text }
    );

    if (!emailResult.success) {
      console.error('Failed to send partner accepted email:', emailResult.error);
    }

    // Create in-app notification
    await createNotification({
      tenantId,
      deliveryOrderId,
      receiverRole: 'BUSINESS_OWNER',
      receiverId: 0,
      notificationType: 'order_accepted',
      title: `Delivery Partner Accepted`,
      body: `${partnerName} has accepted your delivery request.`,
      actionUrl: dashboardUrl,
      status: 'UNREAD',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendPartnerAcceptedNotification:', message);
    return { success: false, error: message };
  }
}

/**
 * Send email + create notification when partner declines
 * Recipients: Business Owner + All Employees
 */
export async function sendPartnerDeclinedNotification(
  tenantId: number,
  orderId: number,
  partnerName: string,
  reason: string,
  dashboardUrl: string,
  deliveryOrderId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch tenant
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
    const businessName = tenant?.name || 'Business Owner';

    // Generate email template
    const emailTemplate = emailTemplates.orderDeclinedTemplate({
      businessName,
      orderId,
      partnerName,
      reason,
      dashboardUrl,
    });

    // Send email to all tenant users
    const emailResult = await sendEmailToTenantUsers(
      tenantId,
      emailTemplate.title || `Delivery for "${businessName}"`,
      { html: emailTemplate.html, text: emailTemplate.text }
    );

    if (!emailResult.success) {
      console.error('Failed to send partner declined email:', emailResult.error);
    }

    await createNotification({
      tenantId,
      deliveryOrderId,
      receiverRole: 'BUSINESS_OWNER',
      receiverId: 0,
      notificationType: 'order_declined',
      title: `📢 Delivery Partner Declined`,
      body: `${partnerName} has declined your delivery request. Reason: ${reason}`,
      actionUrl: dashboardUrl,
      status: 'UNREAD',
    });

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendPartnerDeclinedNotification:', message);
    return { success: false, error: message };
  }
}

/**
 * Send email to remaining partners when another partner wins
 * Recipients: All other delivery partners whose invitations are cancelled
 */
export async function sendDeliveryNoLongerAvailableNotification(
  orderId: number,
  winningPartnerName: string,
  dashboardUrl: string,
  remainingPartners: { id: number; email?: string | null }[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Generate email template
    const emailTemplate = emailTemplates.deliveryNoLongerAvailableTemplate({
      orderId,
      winningPartnerName,
      dashboardUrl,
    });

    // Send to remaining partners
    const emailResult = await sendEmailToAllPartners(
      remainingPartners,
      `📭 Request No Longer Available · ORD-${String(orderId).padStart(5, '0')}`,
      emailTemplate
    );

    if (!emailResult.success) {
      console.error('Failed to send delivery expired email:', emailResult.error);
    }

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error in sendDeliveryNoLongerAvailableNotification:', message);
    return { success: false, error: message };
  }
}
