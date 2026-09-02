# Email Deliverability Configuration Guide

## Overview

This application has been configured with production-grade email settings to maximize inbox placement and improve deliverability. This guide explains the SMTP configuration, authentication requirements, and environment variables needed.

## Environment Variables

### Required SMTP Configuration

```env
# SMTP Server Settings
SMTP_HOST=smtp.your-domain.com          # SMTP server hostname (e.g., smtp.gmail.com, your mail server)
SMTP_PORT=587                           # Port: 587 (TLS), 465 (SSL), 25 (unencrypted - not recommended)
SMTP_USER=noreply@your-domain.com       # Authenticated SMTP user (must match sending domain)
SMTP_PASSWORD=your-app-password         # SMTP password or app-specific password

# Sender Email Configuration
SMTP_FROM_EMAIL=noreply@your-domain.com # Verified sending email address (must match SMTP_USER domain)
SMTP_FROM_NAME="Your Company Name"      # Display name in emails

# Optional: Connection Timeouts (milliseconds)
SMTP_CONNECTION_TIMEOUT=30000           # Default: 30 seconds
SMTP_SOCKET_TIMEOUT=30000               # Default: 30 seconds  
SMTP_GREETING_TIMEOUT=10000             # Default: 10 seconds
SMTP_MAX_CONNECTIONS=5                  # Connection pool size
SMTP_MAX_MESSAGES=100                   # Messages per connection
SMTP_RATE_LIMIT=5                       # Emails per second

# Support Email
NEXT_PUBLIC_BASE_URL=https://your-domain.com
SUPPORT_EMAIL=support@your-domain.com
```

### DKIM Configuration (Recommended)

For maximum inbox placement, configure DKIM signing:

```env
# DKIM Signing (optional but recommended)
DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
DKIM_DOMAIN=your-domain.com
DKIM_KEY_SELECTOR=default               # Your DNS selector

# DMARC Policy (informational only, set this in DNS)
DMARC_POLICY=quarantine                 # or 'none' for monitoring
```

## Critical Requirements for Inbox Placement

### 1. Domain Authentication (Sender Must Match)

**IMPORTANT:** The `SMTP_FROM_EMAIL` and `SMTP_USER` must use the **same domain**.

```env
# ✅ CORRECT
SMTP_USER=noreply@company.com
SMTP_FROM_EMAIL=noreply@company.com

# ✗ WRONG - Will fail SPF/DKIM checks
SMTP_USER=noreply@company.com
SMTP_FROM_EMAIL=notifications@otherdomain.com
```

### 2. SPF Configuration

Add this SPF record to your domain's DNS:

```
v=spf1 include:sendingservice.com ~all
```

Replace `sendingservice.com` with your actual mail service provider.

For Gmail:
```
v=spf1 include:aspmx.l.google.com ~all
```

### 3. DKIM Configuration

Generate DKIM keys:

```bash
# Using OpenSSL
openssl genrsa -out private.key 2048
openssl rsa -in private.key -pubout -out public.key
```

Add DKIM public key to DNS TXT record:

```
default._domainkey.your-domain.com TXT "v=DKIM1; k=rsa; p=YOUR_PUBLIC_KEY_HERE"
```

Set in environment:
```env
DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
DKIM_DOMAIN=your-domain.com
DKIM_KEY_SELECTOR=default
```

### 4. DMARC Configuration

Add DMARC policy to DNS:

```
_dmarc.your-domain.com TXT "v=DMARC1; p=quarantine; rua=mailto:admin@your-domain.com; ruf=mailto:admin@your-domain.com"
```

Options:
- `p=none` - Monitor only, don't enforce
- `p=quarantine` - Move suspicious emails to spam
- `p=reject` - Reject unauthorized emails (stricter)

## Configuration by Email Provider

### Gmail (Google Workspace)

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-google-app-password  # Use app password, not regular password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME="Your Company"
```

**Note:** Regular Gmail accounts must use [App Passwords](https://support.google.com/accounts/answer/185833).

### SendGrid

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=SG.your-sendgrid-api-key
SMTP_FROM_EMAIL=noreply@your-domain.com  # Verified sender
SMTP_FROM_NAME="Your Company"
```

### AWS SES (Simple Email Service)

```env
SMTP_HOST=email-smtp.us-east-1.amazonaws.com  # Region-specific
SMTP_PORT=587
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
SMTP_FROM_EMAIL=noreply@your-verified-domain.com
SMTP_FROM_NAME="Your Company"
```

### Mailgun

```env
SMTP_HOST=smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=postmaster@your-domain.com
SMTP_PASSWORD=your-mailgun-smtp-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME="Your Company"
```

### Self-Hosted Mail Server

```env
SMTP_HOST=mail.your-domain.com
SMTP_PORT=587                           # Or 465 for SSL
SMTP_USER=noreply@your-domain.com
SMTP_PASSWORD=your-mail-server-password
SMTP_FROM_EMAIL=noreply@your-domain.com
SMTP_FROM_NAME="Your Company"
```

## Email Headers for Deliverability

The application automatically adds these headers to all emails:

```
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
X-Mailer: GETDelivery/1.0
X-Priority: 3
List-Unsubscribe: <https://your-domain.com/unsubscribe>
Date: [Current date/time]
Message-ID: [Unique identifier]
```

These headers are RFC-compliant and improve inbox placement.

## Email Content Quality

### What the System Does

✅ **Automatic Improvements:**
- Proper HTML structure with DOCTYPE, html, head, body tags
- Plain text alternative generated from HTML
- Semantic HTML for better parsing
- Consistent company branding and footer
- Professional styling and layout
- Contact information and business footer
- Proper subject lines
- Clear call-to-action buttons

✅ **Spam Prevention:**
- No fake sender names
- No excessive capitalization
- Limited exclamation marks
- No spammy phrases
- HTML entity encoding to prevent injection
- Proper link formatting

### Plain Text Fallback

Every HTML email automatically includes a semantic plain-text version:
- Converts HTML structure to readable text
- Preserves formatting with indentation
- Includes all important information
- Mobile-friendly and accessible

## Retry Logic

The email service includes automatic retry logic for transient failures:

- **Transient errors** (timeouts, connection resets): Retry up to 3 times
- **Permanent errors** (invalid address, authentication failure): No retry
- **Exponential backoff**: 1s, 2s, 4s (capped at 5s)
- **Logging**: Full error details logged without exposing credentials

## Error Handling & Logging

### Successful Send
```
✓ Email sent (attempt 1/3): <message-id>
✓ Email delivered: From=..., To=..., Subject="...", MessageID=...
```

### Failed Send
```
✗ Email failed (attempt 3/3): "Connection timeout" (code: ETIMEDOUT, statusCode: 421)
```

### Recipient Issues
```
✗ No valid recipient email addresses provided
```

**Note:** Credentials are never logged. Only sanitized error messages are displayed.

## Connection Pooling

For better performance, the SMTP connection is pooled:

```env
SMTP_MAX_CONNECTIONS=5        # Reuse up to 5 connections
SMTP_MAX_MESSAGES=100         # Send up to 100 messages per connection
SMTP_RATE_LIMIT=5             # Max 5 emails/second to respect server limits
```

The transporter is a singleton, reused across all requests.

## Recipient Validation

All recipient email addresses are:

✅ **Validated** - Format check (RFC-compliant)
✅ **Normalized** - Lowercase, whitespace trimmed
✅ **Deduplicated** - No duplicate recipients in CC/BCC
✅ **Filtered** - Invalid addresses removed before sending

## Email Authentication Status

On application startup, the system logs authentication status:

```
=== EMAIL AUTHENTICATION STATUS ===
WARNING: DKIM_PRIVATE_KEY not configured. Email deliverability depends on SPF/DMARC...
INFO: DMARC policy not enforced. Ensure DNS DMARC record is configured...
====================================
```

These are informational warnings to improve configuration.

## Troubleshooting

### Emails Going to Spam

1. **Check SPF/DKIM/DMARC:** Use [MXToolbox](https://mxtoolbox.com) to verify DNS records
2. **Verify sender domain:** Ensure `SMTP_FROM_EMAIL` matches `SMTP_USER` domain
3. **Test authentication:** Use [Mail-tester](https://www.mail-tester.com) to check score
4. **Check logs:** Look for warnings during application startup
5. **Review content:** Avoid spam trigger phrases (excessive links, weird formatting)

### Connection Timeouts

1. **Check firewall:** Verify port 587 (or 465) is open to SMTP server
2. **Verify credentials:** Test SMTP login with telnet/nc
3. **Increase timeouts:** Adjust `SMTP_CONNECTION_TIMEOUT` and `SMTP_SOCKET_TIMEOUT`
4. **Check server status:** Ensure SMTP server is running and responding

### Authentication Failures

1. **Verify credentials:** Double-check `SMTP_USER` and `SMTP_PASSWORD`
2. **App passwords:** For Gmail, use app-specific password, not main password
3. **Sender domain:** Ensure sending domain matches authenticated user domain
4. **Check logs:** Look for "401" or "403" error codes

## Production Checklist

- [ ] SPF record added to DNS
- [ ] DKIM keys generated and configured
- [ ] DMARC policy set in DNS
- [ ] `SMTP_FROM_EMAIL` and `SMTP_USER` use same domain
- [ ] SMTP credentials verified and working
- [ ] `NEXT_PUBLIC_BASE_URL` set to production domain
- [ ] Support email configured
- [ ] Application logs reviewed for warnings
- [ ] Test email sent and received in inbox (not spam)
- [ ] Connection pool settings optimized for traffic
- [ ] Rate limits appropriate for SMTP server

## Testing

Use the provided test script to verify email configuration:

```typescript
// test-email.ts
import { sendEmail } from './src/lib/emailService';

const result = await sendEmail({
  to: 'your-test-email@example.com',
  subject: 'Test Email',
  html: '<p>This is a test</p>',
  text: 'This is a test',
});
console.log(result);
```

Run: `npx tsx test-email.ts`

## Support & Documentation

- [RFC 5322 - Internet Message Format](https://tools.ietf.org/html/rfc5322)
- [SPF Documentation](https://www.open-spf.org/)
- [DKIM Documentation](https://en.wikipedia.org/wiki/DomainKeys_Identified_Mail)
- [DMARC Documentation](https://dmarc.org/)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Email Deliverability Best Practices](https://www.spamhaus.org/)
