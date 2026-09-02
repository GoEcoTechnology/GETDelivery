# Email Spam Prevention Guide - GETDelivery

## Problem
Emails are being delivered but going to the **SPAM** folder instead of the primary inbox.

## Root Cause
**Email Authentication is Missing**

Gmail, Outlook, and other email providers use three main authentication methods to verify sender legitimacy:
- **SPF** (Sender Policy Framework) - Authorizes which IP addresses can send emails from your domain
- **DKIM** (DomainKeys Identified Mail) - Digitally signs emails to prove they come from your domain
- **DMARC** (Domain-based Message Authentication, Reporting & Conformance) - Tells providers what to do with unauthenticated emails

Without these configured, your emails are marked as **suspicious** and filtered to spam.

---

## Solution - 4 Step Setup

### Step 1: Add SPF Record to DNS

**What it does:** Tells email providers which servers can send emails from your domain.

**To Add:**
1. Go to your domain registrar (GoDaddy, Namecheap, etc.)
2. Find DNS Settings / DNS Management
3. Add a new **TXT Record**:

**If using Gmail SMTP (smtp.gmail.com):**
```
Host: @
Type: TXT
Value: v=spf1 smtp.google.com ~all
```

**If using SendGrid:**
```
Host: @
Type: TXT
Value: v=spf1 include:sendgrid.net ~all
```

**If using AWS SES:**
```
Host: @
Type: TXT
Value: v=spf1 include:amazonses.com ~all
```

**If using another provider:**
```
Host: @
Type: TXT
Value: v=spf1 include:[provider-domain] ~all
```

**Wait 15-30 minutes** for DNS to propagate.

---

### Step 2: Configure DKIM (Recommended)

**What it does:** Cryptographically signs emails so providers know they're authentic.

#### Part A: Generate DKIM Keys

**On Linux/Mac:**
```bash
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem
cat private-key.pem | base64 | tr -d '\n'
```

**On Windows PowerShell:**
```powershell
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem
Get-Content private-key.pem | certutil -encode -
```

#### Part B: Add Public Key to DNS

1. Get your **public key** content (the part between `-----BEGIN` and `-----END`)
2. In your DNS settings, add a new **TXT Record**:

```
Host: default._domainkey  (or mail._domainkey depending on your setup)
Type: TXT
Value: v=DKIM1; k=rsa; p=[YOUR-PUBLIC-KEY-HERE]
```

**Example:**
```
Host: default._domainkey.yourdomain.com
Type: TXT
Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC...
```

#### Part C: Configure in .env.local

```bash
# .env.local
DKIM_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
[Your private key content here - paste the entire key]
-----END RSA PRIVATE KEY-----"

DKIM_DOMAIN="yourdomain.com"
DKIM_KEY_SELECTOR="default"
```

**Wait 15-30 minutes** for DNS to propagate.

---

### Step 3: Add DMARC Policy (Recommended)

**What it does:** Tells providers how to handle emails that fail SPF/DKIM.

Add a new **TXT Record** in DNS:

```
Host: _dmarc
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com
```

This tells providers:
- `v=DMARC1` - DMARC version
- `p=quarantine` - Quarantine (spam) unauthenticated emails
- `rua=mailto:admin@yourdomain.com` - Send reports to this email

---

### Step 4: Verify Sender Email in .env.local

**CRITICAL:** The sender email domain MUST match the SMTP user domain for SPF/DKIM to work.

```bash
# ✅ CORRECT - Same domain
SMTP_USER="noreply@yourdomain.com"
SMTP_FROM_EMAIL="noreply@yourdomain.com"

# ❌ WRONG - Different domains (will fail SPF/DKIM)
SMTP_USER="noreply@yourdomain.com"
SMTP_FROM_EMAIL="support@different-domain.com"
```

---

## Verification Steps

### Check SPF Record
Go to: https://mxtoolbox.com/spf.aspx
- Enter your domain
- Should show: **SPF record found, syntax OK**

### Check DKIM Record  
Go to: https://mxtoolbox.com/dkim.aspx
- Enter your domain and selector (usually "default")
- Should show: **DKIM record found, syntax OK**

### Check DMARC Record
Go to: https://mxtoolbox.com/dmarc.aspx
- Enter your domain
- Should show: **DMARC record found, syntax OK**

### Send Test Email
1. Create a new delivery in GETDelivery
2. Send to your Gmail/Outlook address
3. Check if email arrives in **Primary Inbox** (not Spam)

---

## Environment Variables Reference

### Required
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-app-password
SMTP_FROM_EMAIL=your-email@yourdomain.com
SMTP_FROM_NAME=GETDelivery
```

### Optional but Recommended
```bash
DKIM_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
DKIM_DOMAIN=yourdomain.com
DKIM_KEY_SELECTOR=default
DMARC_POLICY="v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com"
```

---

## Gmail Specific Tips

1. **Enable "Less Secure Apps"** (if using personal Gmail):
   - Go to: https://myaccount.google.com/security
   - Scroll to "Less secure app access"
   - Turn ON

2. **Use Gmail App Password** (if using 2FA):
   - Enable 2-Step Verification
   - Create an App-specific password
   - Use that in SMTP_PASSWORD

3. **Add Sender to Contacts**:
   - Send a test email to your Gmail
   - If it goes to spam, click "This is not spam"
   - Gmail will learn to trust this sender

---

## Outlook Specific Tips

1. **Add Sender as Trusted**:
   - Go to Outlook Settings → Mail → Safe Senders
   - Add your noreply@yourdomain.com

2. **Use App Password**:
   - Office 365 requires app-specific passwords for SMTP

---

## Common Issues & Solutions

### Issue: "SPF check failed"
- **Cause:** SPF record not configured or incorrect
- **Solution:** Add SPF record and wait 30 minutes for DNS propagation

### Issue: "DKIM check failed"  
- **Cause:** DKIM not configured or private key not matching public key
- **Solution:** Regenerate DKIM keys and update DNS

### Issue: "Email domains don't match"
- **Cause:** SMTP_USER domain doesn't match SMTP_FROM_EMAIL domain
- **Solution:** Use same domain for both (e.g., both @yourdomain.com)

### Issue: "Message signed but signature invalid"
- **Cause:** Private key in .env doesn't match public key in DNS
- **Solution:** Regenerate keys and update both .env and DNS

### Issue: Still going to Spam after SPF/DKIM/DMARC
- **Cause:** Email content flagged by spam filters
- **Solution:** 
  - Ensure emails have both HTML and plain text versions ✓ (Done)
  - Remove suspicious links or attachments
  - Use professional sender name
  - Avoid common spam keywords

---

## What GETDelivery Does (Updated)

The email system now includes:

✅ **Proper MIME Structure** - Multipart HTML + plain text  
✅ **Professional Headers** - SPF/DKIM/DMARC compatible  
✅ **Clean HTML** - No encoding artifacts  
✅ **Authentication Ready** - Accepts DKIM private key  
✅ **Sender Verification** - Validates domain matching  
✅ **Bounce Handling** - Proper Return-Path headers  
✅ **List Headers** - Gmail one-click unsubscribe  
✅ **Environment Variables** - Full SPF/DKIM/DMARC support  

**All you need to do:** Configure SPF/DKIM/DMARC on your DNS.

---

## Quick Start Checklist

- [ ] Add SPF record to DNS
- [ ] (Optional) Generate DKIM keys
- [ ] (Optional) Add DKIM public key to DNS  
- [ ] (Optional) Add DMARC policy to DNS
- [ ] Verify SMTP_FROM_EMAIL matches SMTP_USER domain
- [ ] Set DKIM_PRIVATE_KEY in .env.local (if generated)
- [ ] Wait 15-30 minutes for DNS propagation
- [ ] Send test email
- [ ] Check Primary Inbox (not Spam)

---

## Support

If emails still go to spam after completing these steps:

1. **Check email headers** in Gmail (⋮ → Show original) for:
   - SPF-Result: pass
   - DKIM-Signature: present
   - Authentication-Results: passing

2. **Use MXToolbox** to verify all records are correct

3. **Contact email provider support** with headers if still failing

---

**Last Updated:** 2026-09-02  
**Version:** GETDelivery v1.0 Email System
