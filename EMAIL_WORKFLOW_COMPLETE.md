# Complete Email Workflow Implementation Guide

**Status**: ✅ COMPLETE - All core email workflows implemented
**Date**: 2026-09-02
**Version**: 1.0

---

## Overview

This document describes the complete email notification system for the Delivery Management Platform. The system ensures that all stakeholders (Business Owners, Employees, and Delivery Partners) receive timely, professional email notifications synchronized with in-app notifications at each stage of the delivery workflow.

---

## Implemented Email Workflows

### 1️⃣ Broadcast Delivery Request → Delivery Partners

**Trigger**: Business Owner dispatches order to delivery partners
**Route**: `POST /api/deliveries/[id]/dispatch`
**Recipients**: All ACTIVE delivery partners with valid emails
**Email Template**: `newDeliveryRequestTemplate()`
**Email Status**: ✅ IMPLEMENTED

#### Email Content
- Order reference number (ORD-00XXX)
- Customer name and contact details
- Pickup and dropoff addresses
- Delivery date
- Special instructions
- Accept/Decline buttons
- Order availability countdown (1 hour expiration)

#### In-app Notification
- Real-time notification sent to all partners
- Notification badge shows unread count
- Partner can accept/decline from dashboard

#### Code Location
- Main logic: [src/app/api/deliveries/[id]/dispatch/route.ts](src/app/api/deliveries/[id]/dispatch/route.ts)
- Email helper: `sendBroadcastDeliveryNotification()` in [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)

---

### 2️⃣ Driver Assignment → Assigned Employee/Driver

**Trigger**: Business Owner assigns own driver/vehicle
**Route**: `POST /api/deliveries/[id]/dispatch-internal`
**Recipients**: Assigned driver (employee)
**Email Template**: `driverAssignmentTemplate()`
**Email Status**: ✅ IMPLEMENTED

#### Email Content
- Assignment confirmation
- Driver name and vehicle details
- Batch ID
- Pickup address and time
- Order count
- Pre-departure checklist

#### In-app Notification
- Notification sent to assigned driver
- Dashboard updates immediately
- Shows assignment details

#### Code Location
- Main logic: [src/app/api/deliveries/[id]/dispatch-internal/route.ts](src/app/api/deliveries/[id]/dispatch-internal/route.ts)
- Email helper: `sendDriverAssignmentNotification()` in [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)

---

### 3️⃣ Partner Accepts Delivery → Business Owner + Employees

**Trigger**: Delivery partner accepts broadcast request
**Route**: `POST /api/partner/orders/[id]/accept`
**Recipients**: Business Owner + All active employees of tenant
**Email Template**: `orderAcceptedTemplate()`
**Email Status**: ✅ IMPLEMENTED

#### Email Content
- Delivery partner name and company
- Contact number
- Batch ID
- Accepted timestamp
- Awaiting approval message

#### In-app Notification
- Broadcast notification to all tenant users
- Shows which partner accepted
- Link to review and approve

#### Additional Actions
- Automatically marks other pending invitations as EXPIRED
- Sends "No Longer Available" emails to remaining partners

#### Code Location
- Main logic: [src/app/api/partner/orders/[id]/accept/route.ts](src/app/api/partner/orders/[id]/accept/route.ts)
- Email helper: `sendPartnerAcceptedNotification()` and `sendDeliveryNoLongerAvailableNotification()` in [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)

---

### 4️⃣ Partner Declines Delivery → Business Owner + Employees

**Trigger**: Delivery partner declines broadcast request
**Route**: `POST /api/partner/orders/[id]/decline`
**Recipients**: Business Owner + All active employees of tenant
**Email Template**: `orderDeclinedTemplate()`
**Email Status**: ✅ IMPLEMENTED

#### Email Content
- Delivery partner name and company
- Batch ID
- Declined timestamp
- Decline reason (if provided)
- Status: order still available for other partners

#### In-app Notification
- Broadcast notification to all tenant users
- Shows which partner declined and reason
- Dashboard reflects order status

#### Code Location
- Main logic: [src/app/api/partner/orders/[id]/decline/route.ts](src/app/api/partner/orders/[id]/decline/route.ts)
- Email helper: `sendPartnerDeclinedNotification()` in [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)

---

### 5️⃣ Partner Approval → Delivery Partner

**Trigger**: Business Owner approves partner after acceptance
**Route**: `POST /api/deliveries/[id]/approve-partner`
**Recipients**: Approved delivery partner
**Email Template**: `partnerApprovalTemplate()`
**Email Status**: ✅ IMPLEMENTED (existing implementation maintained)

#### Email Content
- Approval confirmation
- Order reference
- Instructions to log in
- Next steps checklist
- Dashboard link

#### In-app Notification
- Notification sent to partner
- Order status updated to ASSIGNED
- Partner can view delivery details

#### Code Location
- Main logic: [src/app/api/deliveries/[id]/approve-partner/route.ts](src/app/api/deliveries/[id]/approve-partner/route.ts)

---

### 6️⃣ Remaining Partners Notified (Batch Won)

**Trigger**: First partner accepted, other invitations expire
**Route**: Called from accept route (automatic)
**Recipients**: All other delivery partners with pending invitations
**Email Template**: `deliveryNoLongerAvailableTemplate()`
**Email Status**: ✅ IMPLEMENTED

#### Email Content
- Notification that another partner won
- Order reference
- Winning partner name
- Encouragement to browse more requests

#### In-app Notification
- Notification status updated to EXPIRED
- Dashboard shows order no longer available

#### Code Location
- Email helper: `sendDeliveryNoLongerAvailableNotification()` in [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)
- Called from: [src/app/api/partner/orders/[id]/accept/route.ts](src/app/api/partner/orders/[id]/accept/route.ts)

---

## Email Templates

All email templates are located in [src/lib/emailTemplates.ts](src/lib/emailTemplates.ts)

### Available Templates
1. ✅ `newDeliveryRequestTemplate()` - Broadcast partner invitation
2. ✅ `driverAssignmentTemplate()` - Driver/employee assignment
3. ✅ `orderAcceptedTemplate()` - Partner accepted order
4. ✅ `orderDeclinedTemplate()` - Partner declined order
5. ✅ `partnerApprovalTemplate()` - Partner approval notification
6. ✅ `deliveryNoLongerAvailableTemplate()` - Batch won notification
7. ✅ `quotaReachedTemplate()` - Quota reached (available, awaiting trigger)

### Template Features
- Professional HTML design with responsive layout
- Brand colors and branding elements
- Plain text fallback for all templates
- Security: HTML escaping to prevent injection
- SEO-friendly email structure
- Mobile-optimized layouts
- CTA buttons with appropriate styling

---

## Email Workflow Helper

**File**: [src/lib/emailWorkflowHelper.ts](src/lib/emailWorkflowHelper.ts)

### Core Functions

#### `sendBroadcastDeliveryNotification()`
Sends new delivery request emails to all active delivery partners and creates in-app notifications.

```typescript
await sendBroadcastDeliveryNotification(
  tenantId,           // Business owner's tenant ID
  orderId,            // Delivery order ID
  customerName,       // Customer name for email
  pickupAddress,      // Pickup location
  dropoffAddress,     // Delivery location
  deliveryDate,       // Formatted delivery date
  contactNumber,      // Customer contact (optional)
  instructions,       // Special instructions (optional)
  partners,           // Array of partner objects with email
  acceptUrl,          // Link to accept/decline
  deliveryOrderId     // Order ID for notification
);
```

#### `sendDriverAssignmentNotification()`
Sends assignment confirmation to assigned driver and creates notification.

```typescript
await sendDriverAssignmentNotification(
  tenantId,           // Tenant ID
  driverId,          // Driver user ID
  driverName,        // Driver name
  vehicleDetails,    // Vehicle plate and type
  batchId,           // Batch ID
  ordersCount,       // Number of orders
  pickupAddress,     // Pickup location
  pickupTime,        // Pickup time (optional)
  dispatchUrl,       // Dashboard link
  deliveryOrderId    // Order ID
);
```

#### `sendPartnerAcceptedNotification()`
Sends acceptance notification to Business Owner and all Employees.

```typescript
await sendPartnerAcceptedNotification(
  tenantId,              // Tenant ID
  orderId,              // Order ID
  partnerName,          // Accepted partner name
  contactNumber,        // Partner contact
  pickupLocation,       // Pickup address
  estimatedArrival,     // ETA (optional)
  dashboardUrl,         // Admin dashboard link
  deliveryOrderId       // Order ID
);
```

#### `sendPartnerDeclinedNotification()`
Sends decline notification to Business Owner and all Employees.

```typescript
await sendPartnerDeclinedNotification(
  tenantId,            // Tenant ID
  orderId,            // Order ID
  partnerName,        // Partner that declined
  reason,             // Decline reason
  dashboardUrl,       // Admin dashboard link
  deliveryOrderId     // Order ID
);
```

#### `sendDeliveryNoLongerAvailableNotification()`
Sends "batch won" notification to remaining partners.

```typescript
await sendDeliveryNoLongerAvailableNotification(
  orderId,                // Order ID
  winningPartnerName,     // Name of winning partner
  dashboardUrl,           // Partner dashboard link
  remainingPartners       // Array of remaining partner objects
);
```

### Helper Functions

#### `sendEmailToTenantUsers()`
Sends email to all Business Owners and Employees of a tenant.

#### `sendEmailToAllPartners()`
Sends email to all delivery partners with valid emails.

#### `createNotification()`
Creates an in-app notification record with full tracking.

---

## Email Service

**File**: [src/lib/emailService.ts](src/lib/emailService.ts)

### Core Features
- ✅ **Production-Grade SMTP**: Configurable timeouts and connection pooling
- ✅ **Retry Logic**: Automatic retry with exponential backoff (3 attempts)
- ✅ **DKIM Support**: Full signing support if keys provided
- ✅ **RFC-Compliant Headers**: SPF/DKIM/DMARC compatible
- ✅ **Email Validation**: Format checking and whitespace trimming
- ✅ **Duplicate Prevention**: Deduplication of recipient addresses
- ✅ **Error Handling**: Detailed logging without credential exposure
- ✅ **Performance**: Connection pooling with rate limiting

### Configuration

#### Required Environment Variables
```env
SMTP_USER=your-smtp-username
SMTP_PASSWORD=your-smtp-password
SMTP_HOST=smtp.gmail.com        # Default: smtp.gmail.com
SMTP_PORT=587                   # Default: 587 (TLS) or 465 (SSL)
SMTP_FROM_EMAIL=noreply@domain.com
SMTP_FROM_NAME=GETDelivery      # Default: GETDelivery
```

#### Optional Environment Variables
```env
# Timeouts (milliseconds)
SMTP_CONNECTION_TIMEOUT=30000   # Default: 30000
SMTP_SOCKET_TIMEOUT=30000       # Default: 30000
SMTP_GREETING_TIMEOUT=10000     # Default: 10000

# Connection Pooling
SMTP_MAX_CONNECTIONS=5          # Default: 5
SMTP_MAX_MESSAGES=100           # Default: 100
SMTP_RATE_LIMIT=5               # Emails per second

# DKIM Signing (optional)
DKIM_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...
DKIM_DOMAIN=example.com         # Default: From email domain
DKIM_KEY_SELECTOR=default
```

### Email Sending

```typescript
import { sendEmail } from '@/lib/emailService';

const result = await sendEmail({
  to: 'recipient@example.com',  // String or string[]
  subject: 'Email Subject',
  html: '<html>...</html>',     // HTML content
  text: 'Plain text version',   // Plain text (optional)
  replyTo: 'reply@domain.com',  // Reply-to address (optional)
  headers: {                     // Custom headers (optional)
    'X-Custom-Header': 'value'
  }
});

if (result.success) {
  console.log('Email sent:', result.messageId);
} else {
  console.error('Email failed:', result.error);
}
```

---

## Notification System

The email workflow is fully synchronized with the in-app notification system through the `notifications` table.

### Notification Table Schema
```typescript
notifications {
  id: serial
  tenantId: integer          // Tenant for access control
  deliveryOrderId: integer   // Associated order
  senderId: integer          // Who sent the notification
  receiverId: integer        // User ID (0 for broadcast)
  receiverRole: string       // BUSINESS_OWNER, EMPLOYEE, DELIVERY_PARTNER
  recipientEmail: string     // Email address
  notificationType: string   // Type identifier
  title: string              // Notification title
  body: string               // Notification body
  actionUrl: string          // Link to action
  status: string             // UNREAD, READ, ARCHIVED
  sentAt: timestamp          // When email was sent
  readAt: timestamp          // When viewed in-app
  clickedAt: timestamp       // When link clicked
  createdAt: timestamp       // Record creation time
}
```

### Notification Types
- `new_delivery_request` - New broadcast offer
- `driver_assignment` - Driver assigned
- `order_accepted` - Partner accepted
- `order_declined` - Partner declined
- `partner_approved` - Approval confirmed
- `quota_reached` - Batch ready for dispatch

---

## Testing the Email Workflow

### 1. Test Broadcast to Partners
```bash
# Step 1: Create delivery order (in UI)
# Step 2: Mark as READY_FOR_DISPATCH
# Step 3: Call dispatch endpoint
curl -X POST http://localhost:3000/api/deliveries/[id]/dispatch \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected: Email sent to all ACTIVE partners with valid emails
```

### 2. Test Driver Assignment
```bash
curl -X POST http://localhost:3000/api/deliveries/[id]/dispatch-internal \
  -H "Authorization: Bearer [token]" \
  -H "Content-Type: application/json" \
  -d '{
    "driverId": 1,
    "vehicleId": 1
  }'

# Expected: Email sent to assigned driver
```

### 3. Test Partner Accept
```bash
curl -X POST http://localhost:3000/api/partner/orders/[id]/accept \
  -H "Authorization: Bearer [partner-token]" \
  -H "Content-Type: application/json" \
  -d '{}'

# Expected:
# - Email sent to Business Owner + Employees
# - "No Longer Available" email sent to other partners
# - In-app notifications created
```

### 4. Test Partner Decline
```bash
curl -X POST http://localhost:3000/api/partner/orders/[id]/decline \
  -H "Authorization: Bearer [partner-token]" \
  -H "Content-Type: application/json" \
  -d '{"declineReason": "Unavailable"}'

# Expected: Email sent to Business Owner + Employees
```

---

## Security Considerations

### Email Validation
- ✅ Format validation: `^[^\s@]+@[^\s@]+\.[^\s@]+$`
- ✅ Whitespace trimming
- ✅ Deduplication before sending
- ✅ No duplicate sends per email address

### Authentication
- ✅ All routes require proper authorization
- ✅ SMTP credentials from environment only
- ✅ No credentials logged or exposed
- ✅ TLS encryption for SMTP (port 587 or 465)

### Data Protection
- ✅ HTML escaping in templates
- ✅ No sensitive data in email body
- ✅ Audit logging for all actions
- ✅ Notification tracking for compliance

### Rate Limiting
- ✅ SMTP rate limiting: 5 emails/second (configurable)
- ✅ Connection pooling prevents abuse
- ✅ Automatic retry with exponential backoff

---

## Monitoring & Debugging

### Enable Debug Logging
The email service logs all operations to console. In production, configure logging to file:

```typescript
// In your logging service
if (process.env.DEBUG_EMAILS === 'true') {
  console.log('Email service debug: enabled');
}
```

### Check Notification Status
Query the notifications table to verify email delivery:

```sql
SELECT 
  id, 
  recipient_email, 
  notification_type, 
  status, 
  sent_at, 
  failed_at, 
  error_message
FROM notifications
ORDER BY created_at DESC
LIMIT 10;
```

### Common Issues

#### Emails Not Sending
1. Check SMTP_USER and SMTP_PASSWORD are set
2. Verify recipient emails are valid
3. Check SMTP_HOST and SMTP_PORT are correct
4. Review console logs for error messages

#### High Bounce Rate
1. Verify From email domain has SPF record
2. Add DKIM signing via environment variables
3. Ensure DMARC policy is configured
4. Check sender domain reputation

#### Delayed Delivery
1. Check connection pool settings
2. Verify SMTP_RATE_LIMIT setting
3. Review retry backoff timing
4. Monitor SMTP server response times

---

## Future Enhancements

### Planned Features
- [ ] Quota reached email trigger
- [ ] Delivery completion notification
- [ ] Delivery cancellation notification
- [ ] Email template customization UI
- [ ] Unsubscribe link support
- [ ] Email open rate tracking
- [ ] Click tracking for CTAs
- [ ] Batch email delivery optimization
- [ ] Email scheduling/delay support
- [ ] Multi-language email support

### Integration Opportunities
- SMS notifications for critical updates
- Push notifications for mobile app
- Slack webhook notifications
- Custom webhook support
- Email preference management

---

## Summary

The email workflow implementation provides:

✅ **All Core Workflows**: 6 critical email scenarios covered
✅ **Professional Templates**: 7 beautiful, responsive email templates
✅ **Reliable Delivery**: Production-grade SMTP with retry logic
✅ **Security**: Email validation, encryption, audit logging
✅ **Synchronization**: All emails coordinated with in-app notifications
✅ **No Breaking Changes**: 100% backward compatible
✅ **Zero TypeScript Errors**: Full type safety maintained

**Status**: Production-ready. Deploy to production with confidence.
