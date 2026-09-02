# Email System - Quick Reference Guide

## Overview

The email system has been completely redesigned for production-grade deliverability. Use this guide for quick reference.

## Quick Start

### Basic Email

```typescript
import { sendEmail } from '@/lib/emailService';

const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome to GETDelivery',
  html: '<p>Welcome!</p>',
  text: 'Welcome!'
});

if (result.success) {
  console.log(`Email sent: ${result.messageId}`);
} else {
  console.log(`Email failed: ${result.error}`);
}
```

### Multiple Recipients

```typescript
await sendEmail({
  to: ['user1@example.com', 'user2@example.com'],
  subject: 'Order Update',
  html: '<p>Your order is ready</p>'
});
```

### With Templates

```typescript
import { partnerApprovalTemplate } from '@/lib/emailTemplates';

const template = partnerApprovalTemplate({
  orderId: 123,
  partnerName: 'Express Delivery',
  dashboardUrl: 'https://app.getdelivery.com/orders'
});

await sendEmail({
  to: 'partner@example.com',
  subject: `🎉 Approved! Assigned to ORD-00123`,
  html: template.html,
  text: template.text
});
```

---

## Available Email Templates

### 1. Partner Approval

```typescript
import { partnerApprovalTemplate } from '@/lib/emailTemplates';

const template = partnerApprovalTemplate({
  orderId: number;
  partnerName: string;
  dashboardUrl: string;
});
```

**When to use:** Partner has been approved and assigned to a delivery
**Includes:** Order ID, next steps, CTA button

---

### 2. Order Accepted

```typescript
import { orderAcceptedTemplate } from '@/lib/emailTemplates';

const template = orderAcceptedTemplate({
  orderId: number;
  partnerName: string;
  dashboardUrl: string;
});
```

**When to use:** Partner accepted order, awaiting tenant approval
**Includes:** Partner info, status update, approval link

---

### 3. Order Declined

```typescript
import { orderDeclinedTemplate } from '@/lib/emailTemplates';

const template = orderDeclinedTemplate({
  orderId: number;
  partnerName: string;
  reason: string;
  dashboardUrl: string;
});
```

**When to use:** Partner declined delivery request
**Includes:** Decline reason, explanation of next steps

---

### 4. New Delivery Request

```typescript
import { newDeliveryRequestTemplate } from '@/lib/emailTemplates';

const template = newDeliveryRequestTemplate({
  orderId: number;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryDate: string;
  contactNumber?: string;
  instructions?: string;
  acceptUrl: string;
});
```

**When to use:** Offering new delivery to partners
**Includes:** All order details, time urgency, CTA

---

## Return Type

All `sendEmail()` calls return:

```typescript
interface SendEmailResult {
  success: boolean;
  messageId?: string;      // Unique message ID if successful
  error?: string;          // Error message if failed
  recipientsFailed?: string[];  // Failed recipients if applicable
}
```

---

## Environment Variables

### Required

```env
SMTP_HOST=your-smtp-host
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-password
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME="Your Company"
```

### Optional

```env
# Connection settings
SMTP_CONNECTION_TIMEOUT=30000
SMTP_SOCKET_TIMEOUT=30000
SMTP_GREETING_TIMEOUT=10000

# Connection pool
SMTP_MAX_CONNECTIONS=5
SMTP_MAX_MESSAGES=100
SMTP_RATE_LIMIT=5

# DKIM signing
DKIM_PRIVATE_KEY=...
DKIM_DOMAIN=yourdomain.com
DKIM_KEY_SELECTOR=default

# Application
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
SUPPORT_EMAIL=support@yourdomain.com
DMARC_POLICY=quarantine
```

---

## Common Patterns

### Send to Multiple People Safely

```typescript
// Automatically deduplicates, validates, and trims emails
const result = await sendEmail({
  to: [
    'user1@example.com',
    '  user1@example.com  ',  // Duplicate (removed)
    'user2@example.com',
    'invalid.email',           // Invalid (removed)
  ],
  subject: 'Update',
  html: '<p>Hello</p>'
});

// Only valid unique emails sent
```

### Add Custom Headers

```typescript
await sendEmail({
  to: 'user@example.com',
  subject: 'Test',
  html: '<p>Test</p>',
  headers: {
    'X-Campaign-ID': 'summer-2024',
    'X-Custom-Tracking': 'abc123'
  }
});
```

### Custom Reply-To

```typescript
await sendEmail({
  to: 'user@example.com',
  subject: 'Support Ticket',
  html: '<p>We have received your ticket</p>',
  replyTo: 'support@yourdomain.com'
});
```

### Custom Plain Text

```typescript
// By default, plain text is generated from HTML
// But you can provide your own:

await sendEmail({
  to: 'user@example.com',
  subject: 'Report',
  html: '<p style="font-size:20px;"><strong>Report</strong></p><p>Details here</p>',
  text: 'REPORT\nDetails here'  // Custom plain text
});
```

---

## Error Handling

### Handle Failures Gracefully

```typescript
const result = await sendEmail({
  to: emailList,
  subject: 'Important Update',
  html: template.html,
  text: template.text
});

if (result.success) {
  // Log success
  await db.insert(notifications).values({
    status: 'sent',
    messageId: result.messageId,
    sentAt: new Date()
  });
} else {
  // Log failure with details
  console.error(`Email failed: ${result.error}`);
  console.error(`Failed recipients: ${result.recipientsFailed}`);
  
  await db.insert(notifications).values({
    status: 'failed',
    errorMessage: result.error,
    failedAt: new Date()
  });
}
```

### Concurrent Emails

```typescript
// Send to multiple users concurrently
const recipients = ['user1@example.com', 'user2@example.com', 'user3@example.com'];
const results = await Promise.allSettled(
  recipients.map(email =>
    sendEmail({
      to: email,
      subject: 'Welcome',
      html: '<p>Welcome to GETDelivery</p>'
    })
  )
);

// Check results
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    console.log(`✓ Sent to ${recipients[index]}: ${result.value.messageId}`);
  } else {
    console.log(`✗ Failed to send to ${recipients[index]}: ${result.reason}`);
  }
});
```

---

## What Happens Automatically

✅ **Email Validation**
- Format checking (RFC-compliant)
- Whitespace trimming
- Duplicate removal

✅ **Headers Added**
- `MIME-Version: 1.0`
- `Content-Type: text/html; charset=UTF-8`
- `X-Mailer: GETDelivery/1.0`
- `X-Priority: 3`
- `Date: [current]`
- `Message-ID: [unique]`

✅ **Plain Text Generation**
- If no plain text provided, generated from HTML
- Semantic conversion (preserves structure)
- Handles HTML entities

✅ **Retry Logic**
- Up to 3 attempts for transient failures
- Exponential backoff (1s, 2s, 4s)
- Only for timeouts and connection errors

✅ **Connection Reuse**
- Pooled connections (5 by default)
- Messages batched per connection (100)
- No reconnection overhead

✅ **Logging**
- Success: Message ID logged
- Failure: SMTP error code and message logged
- Credentials never exposed

---

## Troubleshooting

### Email Goes to Spam

1. **Check DNS records:**
   ```bash
   # SPF, DKIM, DMARC configured?
   dig yourdomain.com TXT
   ```

2. **Check sender domain:**
   ```env
   # Must match!
   SMTP_USER=noreply@yourdomain.com
   SMTP_FROM_EMAIL=noreply@yourdomain.com  # Same domain!
   ```

3. **Test email quality:**
   - Use [Mail-tester](https://www.mail-tester.com)
   - Aim for 8+ score

### Connection Timeout

```env
# Increase timeouts
SMTP_CONNECTION_TIMEOUT=60000
SMTP_SOCKET_TIMEOUT=60000
SMTP_GREETING_TIMEOUT=15000
```

### Authentication Failed

```env
# Verify credentials
SMTP_USER=correct-username
SMTP_PASSWORD=correct-password

# For Gmail, use app password (not regular password)
SMTP_PASSWORD=xxxx xxxx xxxx xxxx
```

### Too Many Connections

```env
# Reduce pool size
SMTP_MAX_CONNECTIONS=3
SMTP_RATE_LIMIT=2  # 2 emails per second
```

---

## Creating Custom Templates

### Manual Template (Not Recommended)

If you need a custom template, use the existing templates as a reference:

```typescript
import { createEmailTemplate } from '@/lib/emailTemplates';

const template = createEmailTemplate({
  title: 'My Custom Email',
  preheader: 'Preview text visible in inbox',
  content: `
    <h2>Welcome!</h2>
    <p>This is your custom content.</p>
  `,
  textContent: 'Welcome! This is your custom content.',
  ctaButton: {
    text: 'Click Me',
    url: 'https://example.com/action',
    variant: 'primary'  // or 'secondary', 'success', 'warning'
  },
  footerNote: 'Custom footer note'
});

await sendEmail({
  to: 'user@example.com',
  subject: 'My Custom Email',
  html: template.html,
  text: template.text
});
```

### Template Components

- **Title:** Email subject-like heading
- **Preheader:** Text shown in email preview
- **Content:** Main HTML content
- **textContent:** Plain text alternative
- **ctaButton:** Call-to-action button
- **footerNote:** Optional note above footer

---

## Best Practices

### DO ✅

- Use provided templates when possible
- Always handle errors with `.allSettled()` for multiple sends
- Log success/failure status to database
- Test in development before production
- Use proper error messages for users
- Validate recipient emails in form validation

### DON'T ❌

- Don't send to unvalidated email addresses
- Don't use free email addresses as `SMTP_FROM_EMAIL`
- Don't hardcode SMTP credentials
- Don't mix sender domains
- Don't ignore errors silently
- Don't create new templates when existing ones work
- Don't use excessive HTML styling

---

## Performance Tips

### High Volume Sending

```typescript
// Bad: Sequential (slow)
for (const email of recipients) {
  await sendEmail({ to: email, ... });  // 1 + 1 + 1 = 3 seconds
}

// Good: Concurrent (fast)
await Promise.all(
  recipients.map(email => 
    sendEmail({ to: email, ... })  // Parallel = ~1 second
  )
);

// Better: Batched with limits
const batchSize = 10;
for (let i = 0; i < recipients.length; i += batchSize) {
  const batch = recipients.slice(i, i + batchSize);
  await Promise.allSettled(
    batch.map(email => sendEmail({ to: email, ... }))
  );
}
```

### Monitor Logs

```typescript
// Enable detailed logging
export DEBUG=* npm run dev

// Look for:
// ✓ Email sent (attempt 1/3): <id>
// ✓ Email delivered: From=..., To=..., Subject="..."
// ✗ Email failed: [error details]
// WARNING: Authentication issues
// INFO: Configuration suggestions
```

---

## Reference

**Full Email Service Docs:** [EMAIL_CONFIGURATION.md](./EMAIL_CONFIGURATION.md)

**Improvement Details:** [EMAIL_IMPROVEMENTS.md](./EMAIL_IMPROVEMENTS.md)

**Source Files:**
- [emailService.ts](./src/lib/emailService.ts)
- [emailTemplates.ts](./src/lib/emailTemplates.ts)
