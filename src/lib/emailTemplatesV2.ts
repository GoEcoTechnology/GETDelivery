/**
 * GETDelivery Professional Email Templates v2
 * 
 * Completely rebuilt email system with:
 * - Proper HTML/plain-text multipart emails
 * - Zero encoding artifacts (no =3D, =20, MIME boundaries)
 * - Professional responsive design
 * - Production-ready formatting
 * - Environment variable URL support
 * - No markdown, no localhost URLs
 */

// Get the base URL from environment, fallback to localhost for development
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.ph';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@getdelivery.com';
const COMPANY_NAME = 'GETDelivery';

// Brand colors (Formal, natural, legit styling)
const COLORS = {
  primary: '#0f172a',    // Dark Slate (Formal)
  secondary: '#334155',  // Slate
  success: '#0f172a',    // Use dark slate for primary actions instead of bright green
  warning: '#ea580c',    // Subdued orange
  error: '#dc2626',      // Standard red
  text: '#0f172a',       // Dark text
  muted: '#64748b',      // Gray
  border: '#e2e8f0',     // Light gray border
  background: '#ffffff', // White background
};

/**
 * Email template response interface
 */
export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
  preheader?: string;
}

/**
 * Escape HTML to prevent injection
 */
function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Create professional email wrapper with header and footer
 */
function createEmailWrapper(options: {
  preheader?: string;
  content: string;
  textContent: string;
}): { html: string; text: string } {
  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${COMPANY_NAME}</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      min-width: 100% !important;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: ${COLORS.text};
    }
    * {
      margin: 0;
      padding: 0;
      border: 0;
    }
    table {
      border-collapse: collapse;
      border-spacing: 0;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
      width: 100%;
    }
    td {
      padding: 0;
      margin: 0;
      mso-padding-alt: 0;
    }
    img {
      border: 0;
      outline: none;
      text-decoration: none;
      max-width: 100%;
      height: auto;
      display: block;
    }
    a {
      color: ${COLORS.primary};
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    h1, h2, h3, h4, h5, h6 {
      margin: 0;
      padding: 0;
      font-weight: 700;
    }
    p {
      margin: 0;
      padding: 0;
    }
    .button {
      display: inline-block;
      padding: 14px 32px;
      background-color: ${COLORS.success};
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      text-align: center;
      border: none;
      mso-padding-alt: 14px 32px;
      mso-border-alt: none;
    }
    .button-secondary {
      background-color: ${COLORS.primary};
    }
    .button:hover {
      opacity: 0.9;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div role="article" aria-roledescription="email" aria-label="${COMPANY_NAME}" lang="en">
    ${options.preheader ? `<div style="display:none;font-size:1px;color:#fefce8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(options.preheader)}</div>` : ''}
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:40px 20px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="background-color:#ffffff;border-radius:16px 16px 0 0;padding:40px 40px 30px;text-align:center;border-bottom:1px solid ${COLORS.border};">
                <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.5px;margin:0 0 4px 0;color:${COLORS.primary};text-transform:uppercase;">${COMPANY_NAME}</h1>
                <p style="font-size:13px;color:${COLORS.muted};margin:0;letter-spacing:0.05em;text-transform:uppercase;">Delivery Management System</p>
              </td>
            </tr>

            <!-- Body Content -->
            <tr>
              <td style="background:white;padding:40px;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};">
                ${options.content}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:${COLORS.background};border-radius:0 0 16px 16px;padding:32px 40px;text-align:center;border-left:1px solid ${COLORS.border};border-right:1px solid ${COLORS.border};border-bottom:1px solid ${COLORS.border};font-size:13px;color:${COLORS.muted};">
                <p style="margin:0 0 16px 0;"><strong>${COMPANY_NAME}</strong></p>
                <p style="margin:0;color:${COLORS.muted};font-size:12px;">© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>`;

  const text = `${COMPANY_NAME}
${'='.repeat(COMPANY_NAME.length)}

${options.textContent}

---
© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.`;

  return { html, text };
}

/**
 * New Delivery Request Template - PROFESSIONAL VERSION
 */
export function newDeliveryRequestTemplate(options: {
  orderId: number;
  customerName: string;
  businessOwnerName: string;
  contactNumber?: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryDate: string;
  instructions?: string;
  acceptUrl: string;
  declineUrl?: string;
}): EmailTemplate {
  const orderRef = `ORD-${String(options.orderId).padStart(5, '0')}`;

  const content = `
    <h2 style="font-size:24px;margin-bottom:8px;color:${COLORS.text};">Delivery Request Assignment</h2>
    <p style="color:${COLORS.muted};margin-bottom:28px;font-size:15px;line-height:1.6;">
      A new delivery order is available and requires your response. Please review the details below and confirm your availability to complete this delivery.
    </p>
    


    <!-- Delivery Details Card -->
    <div style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin-bottom:28px;">
      <h3 style="font-size:14px;font-weight:700;color:${COLORS.text};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid ${COLORS.border};">Delivery Information</h3>
      
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;vertical-align:top;">Business Owner</td>
          <td style="padding:12px 0;color:${COLORS.text};font-weight:600;vertical-align:top;">${escapeHtml(options.businessOwnerName)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;vertical-align:top;">Customer Name</td>
          <td style="padding:12px 0;color:${COLORS.text};font-weight:600;vertical-align:top;">${escapeHtml(options.customerName)}</td>
        </tr>
        ${options.contactNumber ? `
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Contact Number</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;"><a href="tel:${encodeURIComponent(options.contactNumber)}" style="color:${COLORS.primary};font-weight:500;">${escapeHtml(options.contactNumber)}</a></td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Pickup Address</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;word-break:break-word;line-height:1.5;">${escapeHtml(options.pickupAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Delivery Address</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;word-break:break-word;line-height:1.5;">${escapeHtml(options.dropoffAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Scheduled Date</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;">${escapeHtml(options.deliveryDate)}</td>
        </tr>
        ${options.instructions ? `
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Special Instructions</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;word-break:break-word;line-height:1.5;">${escapeHtml(options.instructions)}</td>
        </tr>
        ` : ''}
      </table>
    </div>


    <div style="text-align:center;margin:32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(options.acceptUrl)}" style="display:inline-block;padding:16px 48px;background-color:${COLORS.success};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;text-align:center;mso-padding-alt:16px 48px;">Accept Delivery Request</a>
          </td>
        </tr>
      </table>
      ${options.declineUrl ? `
      <p style="margin:8px 0 0 0;font-size:13px;color:${COLORS.muted};">
        <a href="${escapeHtml(options.declineUrl)}" style="color:${COLORS.error};text-decoration:none;">Decline this request</a>
      </p>
      ` : ''}
    </div>

  `;

  const textContent = `DELIVERY REQUEST ASSIGNMENT
============================

A new delivery order is available and requires your response.

DELIVERY INFORMATION
====================

Business Owner: ${escapeHtml(options.businessOwnerName)}
Customer: ${escapeHtml(options.customerName)}
${options.contactNumber ? `Contact: ${escapeHtml(options.contactNumber)}\n` : ''}
Pickup Address:
${escapeHtml(options.pickupAddress)}

Delivery Address:
${escapeHtml(options.dropoffAddress)}

Scheduled Date: ${escapeHtml(options.deliveryDate)}
${options.instructions ? `\nSpecial Instructions:\n${escapeHtml(options.instructions)}\n` : ''}

To review and accept this request:
${options.acceptUrl}

${options.declineUrl ? `To decline this request:\n${options.declineUrl}\n` : ''}



This is an automated notification from ${COMPANY_NAME}.
If this delivery has already been accepted by another partner, please disregard this email.`;

  const { html, text } = createEmailWrapper({
    preheader: `Delivery request requires your response.`,
    content,
    textContent,
  });

  return {
    subject: `Delivery Request - Action Required`,
    html,
    text,
    preheader: `New delivery available for ${options.customerName}`,
  };
}

/**
 * Partner Approved Template
 */
export function partnerApprovedTemplate(options: {
  orderId: number;
  partnerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryDate: string;
  dashboardUrl: string;
}): EmailTemplate {
  const orderRef = `ORD-${String(options.orderId).padStart(5, '0')}`;

  const content = `
    <h2 style="font-size:24px;margin-bottom:8px;color:${COLORS.text};">Delivery Assignment Approved</h2>
    <p style="color:${COLORS.muted};margin-bottom:24px;font-size:15px;line-height:1.6;">
      Congratulations! You have been officially approved and assigned to the following delivery.
    </p>
    
    <!-- Success Banner -->
    <div style="background:#dcfce7;border:1px solid #86efac;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center;">
      <p style="margin:0;font-size:14px;color:#15803d;font-weight:600;">Assignment Confirmed</p>
      <p style="margin:8px 0 0 0;font-size:24px;font-weight:900;color:${COLORS.success};">${escapeHtml(orderRef)}</p>
    </div>

    <!-- Delivery Details -->
    <div style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin-bottom:28px;">
      <h3 style="font-size:14px;font-weight:700;color:${COLORS.text};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid ${COLORS.border};">Assignment Details</h3>
      
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;">Pickup Address</td>
          <td style="padding:12px 0;color:${COLORS.text};word-break:break-word;line-height:1.5;">${escapeHtml(options.pickupAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;">Delivery Address</td>
          <td style="padding:12px 0;color:${COLORS.text};word-break:break-word;line-height:1.5;">${escapeHtml(options.dropoffAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;">Scheduled Date</td>
          <td style="padding:12px 0;color:${COLORS.text};">${escapeHtml(options.deliveryDate)}</td>
        </tr>
      </table>
    </div>

    <!-- Next Steps -->
    <div style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(options.dashboardUrl)}" style="display:inline-block;padding:16px 48px;background-color:${COLORS.primary};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;mso-padding-alt:16px 48px;">Go to Dashboard</a>
    </div>

    <!-- Instructions -->
    <div style="background:#f0f9ff;border-left:4px solid ${COLORS.primary};border-radius:0 8px 8px 0;padding:14px 16px;margin-top:24px;">
      <p style="margin:0;font-size:13px;color:#0c4a6e;line-height:1.6;"><strong>Before Pickup:</strong> Verify your vehicle status and fuel level. Review your delivery route and confirm all delivery instructions.</p>
    </div>
  `;

  const textContent = `DELIVERY ASSIGNMENT APPROVED
==============================

Congratulations! You have been officially approved and assigned to the following delivery.

ORDER REFERENCE: ${orderRef}
STATUS: APPROVED & ASSIGNED

ASSIGNMENT DETAILS
===================

Pickup Address:
${escapeHtml(options.pickupAddress)}

Delivery Address:
${escapeHtml(options.dropoffAddress)}

Scheduled Date: ${escapeHtml(options.deliveryDate)}

BEFORE YOU BEGIN
================

Verify your vehicle status and fuel level.
Review your delivery route and confirm all delivery instructions.

View and manage your assignment:
${options.dashboardUrl}

---

This is an automated confirmation from ${COMPANY_NAME}.`;

  const { html, text } = createEmailWrapper({
    preheader: `${orderRef} - You have been approved for this delivery`,
    content,
    textContent,
  });

  return {
    subject: `Approved: ${orderRef} - You're Assigned to This Delivery`,
    html,
    text,
    preheader: `${orderRef} - Assignment confirmed`,
  };
}

/**
 * Generic delivery-related email template
 */
export function deliveryStatusChangeTemplate(options: {
  orderId: number;
  title: string;
  message: string;
  details?: Record<string, string>;
  actionUrl?: string;
  actionText?: string;
}): EmailTemplate {
  const orderRef = `ORD-${String(options.orderId).padStart(5, '0')}`;

  const detailsHtml = options.details ? `
    <div style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin-bottom:28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        ${Object.entries(options.details).map(([key, value]) => `
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;vertical-align:top;">${escapeHtml(key)}</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;">${escapeHtml(value)}</td>
        </tr>
        `).join('')}
      </table>
    </div>
  ` : '';

  const content = `
    <h2 style="font-size:24px;margin-bottom:8px;color:${COLORS.text};">${escapeHtml(options.title)}</h2>
    <p style="color:${COLORS.muted};margin-bottom:24px;font-size:15px;line-height:1.6;font-weight:500;">Order Reference: <strong style="color:${COLORS.text};">${escapeHtml(orderRef)}</strong></p>
    
    <p style="color:${COLORS.text};margin-bottom:24px;font-size:15px;line-height:1.6;">${escapeHtml(options.message)}</p>
    
    ${detailsHtml}
    
    ${options.actionUrl ? `
    <div style="text-align:center;margin:32px 0;">
      <a href="${escapeHtml(options.actionUrl)}" style="display:inline-block;padding:16px 48px;background-color:${COLORS.primary};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;mso-padding-alt:16px 48px;">${escapeHtml(options.actionText || 'View Details')}</a>
    </div>
    ` : ''}
  `;

  const textContent = `${options.title.toUpperCase()}
${'='.repeat(options.title.length)}

Order Reference: ${orderRef}

${options.message}

${options.details ? `\nDetails:\n${Object.entries(options.details).map(([k, v]) => `${k}: ${v}`).join('\n')}` : ''}

${options.actionUrl ? `\nView and manage this order:\n${options.actionUrl}` : ''}`;

  const { html, text } = createEmailWrapper({
    preheader: `${orderRef} - ${options.title}`,
    content,
    textContent,
  });

  return {
    subject: `${orderRef} - ${options.title}`,
    html,
    text,
  };
}

/**
 * Partner Acceptance Template
 * Notification when a delivery partner accepts an order
 * Sent to: Business Owner + Employees
 */
export function orderAcceptedTemplate(options: {
  businessName: string;
  customerName: string;
  orderId: number;
  deliveryDate: string;
  pickupAddress: string;
  dropoffAddress: string;
  partnerName: string;
  acceptanceTime: string;
  dashboardUrl: string;
}): EmailTemplate {
  const orderRef = `ORD-${String(options.orderId).padStart(5, '0')}`;

  const content = `
    <div style="background:linear-gradient(135deg,#ecfdf5,#f0fdf4);border:1px solid #86efac;border-radius:12px;padding:24px;margin-bottom:28px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">✓</div>
      <h2 style="font-size:24px;margin:0 0 8px 0;color:${COLORS.success};font-weight:700;">Delivery Accepted!</h2>
      <p style="color:${COLORS.text};margin:0;font-size:15px;font-weight:500;">Your delivery order has been accepted by a partner.</p>
    </div>

    <!-- Delivery Details Card -->
    <div style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin-bottom:28px;">
      <h3 style="font-size:14px;font-weight:700;color:${COLORS.text};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid ${COLORS.border};">Delivery Information</h3>
      
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;vertical-align:top;">Business Name</td>
          <td style="padding:12px 0;color:${COLORS.text};font-weight:600;vertical-align:top;">${escapeHtml(options.businessName)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;width:35%;vertical-align:top;">Customer Name</td>
          <td style="padding:12px 0;color:${COLORS.text};font-weight:600;vertical-align:top;">${escapeHtml(options.customerName)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Order ID</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;">${escapeHtml(orderRef)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Delivery Date</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;">${escapeHtml(options.deliveryDate)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Pickup Address</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;word-break:break-word;line-height:1.5;">${escapeHtml(options.pickupAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Delivery Address</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;word-break:break-word;line-height:1.5;">${escapeHtml(options.dropoffAddress)}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Current Status</td>
          <td style="padding:12px 0;vertical-align:top;"><span style="color:#059669;font-weight:600;">Accepted</span></td>
        </tr>
        <tr>
          <td style="padding:12px 0;color:${COLORS.muted};font-weight:600;vertical-align:top;">Acceptance Time</td>
          <td style="padding:12px 0;color:${COLORS.text};vertical-align:top;">${escapeHtml(options.acceptanceTime)}</td>
        </tr>
      </table>
    </div>

    <!-- Partner Information Card -->
    <div style="background:${COLORS.background};border:1px solid ${COLORS.border};border-radius:12px;padding:24px;margin-bottom:28px;">
      <h3 style="font-size:14px;font-weight:700;color:${COLORS.text};text-transform:uppercase;letter-spacing:0.08em;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid ${COLORS.border};">Assigned Partner</h3>
      
      <div style="display:flex;align-items:center;gap:12px;padding:16px;background:white;border-radius:8px;border:1px solid ${COLORS.border};">
        <div>
          <div style="font-size:15px;font-weight:600;color:${COLORS.text};">${escapeHtml(options.partnerName)}</div>
        </div>
      </div>
    </div>

    <!-- Action Button -->
    <div style="text-align:center;margin:32px 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
        <tr>
          <td align="center">
            <a href="${escapeHtml(options.dashboardUrl)}" style="display:inline-block;padding:16px 48px;background-color:${COLORS.primary};color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;text-align:center;mso-padding-alt:16px 48px;">View More</a>
          </td>
        </tr>
      </table>
    </div>
  `;

  const textContent = `DELIVERY ACCEPTED
=================

Your delivery order has been accepted by a partner.

DELIVERY INFORMATION
====================

Business Name: ${escapeHtml(options.businessName)}
Customer Name: ${escapeHtml(options.customerName)}
Order ID: ${orderRef}
Delivery Date: ${escapeHtml(options.deliveryDate)}
Pickup Address: ${escapeHtml(options.pickupAddress)}
Delivery Address: ${escapeHtml(options.dropoffAddress)}
Current Status: Accepted
Acceptance Time: ${escapeHtml(options.acceptanceTime)}

ASSIGNED PARTNER
================

Company: ${escapeHtml(options.partnerName)}

To view the delivery in dashboard:
${options.dashboardUrl}
`;

  const { html, text } = createEmailWrapper({
    preheader: `Delivery accepted by partner - Action required`,
    content,
    textContent,
  });

  return {
    subject: `Delivery for "${options.businessName}"`,
    html,
    text,
  };
}
