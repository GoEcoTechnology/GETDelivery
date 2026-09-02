export interface EmailTemplate {
  html: string;
  text: string;
}

const COMPANY_NAME = 'GETDelivery';
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@getdelivery.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function orderRef(orderId: number): string {
  return `ORD-${String(orderId).padStart(5, '0')}`;
}

function wrapEmail(options: {
  title: string;
  preheader?: string;
  content: string;
  textContent: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}): EmailTemplate {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;color:#1e293b;font-family:Arial,sans-serif;line-height:1.6;">
  ${options.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(options.preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:#111827;color:#ffffff;">
              <div style="font-size:24px;font-weight:700;letter-spacing:-0.02em;">${COMPANY_NAME}</div>
              <div style="font-size:13px;opacity:0.85;margin-top:4px;">${escapeHtml(options.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${options.content}
              ${options.ctaUrl && options.ctaText ? `
              <div style="margin-top:28px;">
                <a href="${escapeHtml(options.ctaUrl)}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:700;font-size:14px;">${escapeHtml(options.ctaText)}</a>
              </div>` : ''}
              ${options.footerNote ? `<p style="margin:24px 0 0;color:#64748b;font-size:13px;">${escapeHtml(options.footerNote)}</p>` : ''}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px;">
              <div>${COMPANY_NAME}</div>
              <div style="margin-top:4px;">Visit: <a href="${BASE_URL}" style="color:#475569;">${BASE_URL}</a></div>
              <div>Support: <a href="mailto:${SUPPORT_EMAIL}" style="color:#475569;">${SUPPORT_EMAIL}</a></div>
              <div style="margin-top:4px;">&copy; ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    COMPANY_NAME,
    options.title,
    '',
    options.textContent.trim(),
    '',
    `Visit: ${BASE_URL}`,
    `Support: ${SUPPORT_EMAIL}`,
    `© ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.`,
  ].join('\n');

  return { html, text };
}

export function partnerApprovalTemplate(options: {
  orderId: number;
  partnerName: string;
  dashboardUrl: string;
}): EmailTemplate {
  const ref = orderRef(options.orderId);
  return wrapEmail({
    title: `Approved: ${ref}`,
    preheader: `You have been approved for ${ref}.`,
    content: `
      <h2 style="margin:0 0 12px;font-size:22px;">Your delivery application was approved</h2>
      <p style="margin:0 0 16px;color:#64748b;">You have been assigned to this delivery request and can review the details in your dashboard.</p>
      <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(ref)}</p>
      <p style="margin:0 0 8px;"><strong>Partner:</strong> ${escapeHtml(options.partnerName)}</p>
    `,
    textContent: [
      `Your delivery application was approved.`,
      `Order: ${ref}`,
      `Partner: ${options.partnerName}`,
      `Review details in your dashboard: ${options.dashboardUrl}`,
    ].join('\n'),
    ctaText: 'Go to Dashboard',
    ctaUrl: options.dashboardUrl,
    footerNote: 'This is an automated transactional email.',
  });
}

export function orderAcceptedTemplate(options: {
  orderId: number;
  partnerName: string;
  dashboardUrl: string;
}): EmailTemplate {
  const ref = orderRef(options.orderId);
  return wrapEmail({
    title: `Order Accepted: ${ref}`,
    preheader: `A delivery partner accepted ${ref}.`,
    content: `
      <h2 style="margin:0 0 12px;font-size:22px;">Delivery request accepted</h2>
      <p style="margin:0 0 16px;color:#64748b;">A partner has accepted your delivery request and is awaiting your review.</p>
      <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(ref)}</p>
      <p style="margin:0 0 8px;"><strong>Partner:</strong> ${escapeHtml(options.partnerName)}</p>
    `,
    textContent: [
      `Delivery request accepted.`,
      `Order: ${ref}`,
      `Partner: ${options.partnerName}`,
      `Review and approve in your dashboard: ${options.dashboardUrl}`,
    ].join('\n'),
    ctaText: 'Review & Approve',
    ctaUrl: options.dashboardUrl,
    footerNote: 'This is an automated transactional email.',
  });
}

export function orderDeclinedTemplate(options: {
  orderId: number;
  partnerName: string;
  reason: string;
  dashboardUrl: string;
}): EmailTemplate {
  const ref = orderRef(options.orderId);
  return wrapEmail({
    title: `Order Declined: ${ref}`,
    preheader: `A partner declined ${ref}.`,
    content: `
      <h2 style="margin:0 0 12px;font-size:22px;">Delivery request declined</h2>
      <p style="margin:0 0 16px;color:#64748b;">The request has been returned to pending status and will be offered to other partners.</p>
      <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(ref)}</p>
      <p style="margin:0 0 8px;"><strong>Partner:</strong> ${escapeHtml(options.partnerName)}</p>
      <p style="margin:0;"><strong>Reason:</strong> ${escapeHtml(options.reason || 'Not specified')}</p>
    `,
    textContent: [
      `Delivery request declined.`,
      `Order: ${ref}`,
      `Partner: ${options.partnerName}`,
      `Reason: ${options.reason || 'Not specified'}`,
      `Check status in your dashboard: ${options.dashboardUrl}`,
    ].join('\n'),
    ctaText: 'View Order Status',
    ctaUrl: options.dashboardUrl,
    footerNote: 'This is an automated transactional email.',
  });
}

export function newDeliveryRequestTemplate(options: {
  orderId: number;
  customerName: string;
  pickupAddress: string;
  dropoffAddress: string;
  deliveryDate: string;
  contactNumber?: string;
  instructions?: string;
  acceptUrl: string;
}): EmailTemplate & { subject: string; preheader: string } {
  const ref = orderRef(options.orderId);
  const subject = `New Delivery Request: ${ref}`;
  const preheader = `${ref} requires a response.`;

  const content = `
    <h2 style="margin:0 0 12px;font-size:22px;">New delivery request</h2>
    <p style="margin:0 0 16px;color:#64748b;">Please review the details below and respond within the stated timeframe.</p>
    <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(ref)}</p>
    <p style="margin:0 0 8px;"><strong>Customer:</strong> ${escapeHtml(options.customerName)}</p>
    ${options.contactNumber ? `<p style="margin:0 0 8px;"><strong>Contact:</strong> ${escapeHtml(options.contactNumber)}</p>` : ''}
    <p style="margin:0 0 8px;"><strong>Pickup:</strong> ${escapeHtml(options.pickupAddress)}</p>
    <p style="margin:0 0 8px;"><strong>Dropoff:</strong> ${escapeHtml(options.dropoffAddress)}</p>
    <p style="margin:0 0 8px;"><strong>Date:</strong> ${escapeHtml(options.deliveryDate)}</p>
    ${options.instructions ? `<p style="margin:0;"><strong>Instructions:</strong> ${escapeHtml(options.instructions)}</p>` : ''}
  `;

  const textContent = [
    `New delivery request.`,
    `Order: ${ref}`,
    `Customer: ${options.customerName}`,
    options.contactNumber ? `Contact: ${options.contactNumber}` : '',
    `Pickup: ${options.pickupAddress}`,
    `Dropoff: ${options.dropoffAddress}`,
    `Date: ${options.deliveryDate}`,
    options.instructions ? `Instructions: ${options.instructions}` : '',
    `Respond here: ${options.acceptUrl}`,
  ].filter(Boolean).join('\n');

  const { html, text } = wrapEmail({
    title: subject,
    preheader,
    content,
    textContent,
    ctaText: 'Review Request',
    ctaUrl: options.acceptUrl,
    footerNote: 'This is an automated transactional email.',
  });

  return { subject, preheader, html, text };
}

export function quotaReachedTemplate(options: {
  tenantName: string;
  batchId: number;
  totalOrders: number;
  totalProducts: number;
  quota: number;
  dashboardUrl: string;
}): EmailTemplate & { subject: string; preheader: string } {
  const batchRef = `BATCH-${String(options.batchId).padStart(5, '0')}`;
  const subject = `Quota Reached: ${batchRef}`;
  const preheader = `Your batch is ready for dispatch.`;

  const content = `
    <h2 style="margin:0 0 12px;font-size:22px;">Batch ready for dispatch</h2>
    <p style="margin:0 0 16px;color:#64748b;">Your delivery batch has reached the required quota.</p>
    <p style="margin:0 0 8px;"><strong>Batch:</strong> ${escapeHtml(batchRef)}</p>
    <p style="margin:0 0 8px;"><strong>Total Orders:</strong> ${options.totalOrders}</p>
    <p style="margin:0 0 8px;"><strong>Total Products:</strong> ${options.totalProducts}</p>
    <p style="margin:0;"><strong>Quota:</strong> ${options.quota}</p>
  `;

  const textContent = [
    `Batch ready for dispatch.`,
    `Batch: ${batchRef}`,
    `Total orders: ${options.totalOrders}`,
    `Total products: ${options.totalProducts}`,
    `Quota: ${options.quota}`,
    `Open dashboard: ${options.dashboardUrl}`,
  ].join('\n');

  const { html, text } = wrapEmail({
    title: subject,
    preheader,
    content,
    textContent,
    ctaText: 'Go to Dashboard',
    ctaUrl: options.dashboardUrl,
    footerNote: 'This is an automated transactional email.',
  });

  return { subject, preheader, html, text };
}

export function driverAssignmentTemplate(options: {
  driverName: string;
  vehicleDetails: string;
  batchId: number;
  ordersCount: number;
  pickupAddress: string;
  pickupTime?: string;
  dispatchUrl: string;
}): EmailTemplate & { subject: string; preheader: string } {
  const batchRef = `BATCH-${String(options.batchId).padStart(5, '0')}`;
  const subject = `Driver Assignment: ${batchRef}`;
  const preheader = `You have a new delivery assignment.`;

  const content = `
    <h2 style="margin:0 0 12px;font-size:22px;">Delivery assignment confirmed</h2>
    <p style="margin:0 0 16px;color:#64748b;">Review the assignment details and prepare for pickup.</p>
    <p style="margin:0 0 8px;"><strong>Driver:</strong> ${escapeHtml(options.driverName)}</p>
    <p style="margin:0 0 8px;"><strong>Batch:</strong> ${escapeHtml(batchRef)}</p>
    <p style="margin:0 0 8px;"><strong>Vehicle:</strong> ${escapeHtml(options.vehicleDetails)}</p>
    <p style="margin:0 0 8px;"><strong>Orders:</strong> ${options.ordersCount}</p>
    <p style="margin:0 0 8px;"><strong>Pickup:</strong> ${escapeHtml(options.pickupAddress)}</p>
    ${options.pickupTime ? `<p style="margin:0;"><strong>Pickup Time:</strong> ${escapeHtml(options.pickupTime)}</p>` : ''}
  `;

  const textContent = [
    `Delivery assignment confirmed.`,
    `Driver: ${options.driverName}`,
    `Batch: ${batchRef}`,
    `Vehicle: ${options.vehicleDetails}`,
    `Orders: ${options.ordersCount}`,
    `Pickup: ${options.pickupAddress}`,
    options.pickupTime ? `Pickup time: ${options.pickupTime}` : '',
    `Open assignment: ${options.dispatchUrl}`,
  ].filter(Boolean).join('\n');

  const { html, text } = wrapEmail({
    title: subject,
    preheader,
    content,
    textContent,
    ctaText: 'View Assignment Details',
    ctaUrl: options.dispatchUrl,
    footerNote: 'This is an automated transactional email.',
  });

  return { subject, preheader, html, text };
}

export function deliveryNoLongerAvailableTemplate(options: {
  orderId: number;
  winningPartnerName: string;
  dashboardUrl: string;
}): EmailTemplate & { subject: string; preheader: string } {
  const ref = orderRef(options.orderId);
  const subject = `Request No Longer Available: ${ref}`;
  const preheader = `Another partner accepted ${ref}.`;

  const content = `
    <h2 style="margin:0 0 12px;font-size:22px;">Request no longer available</h2>
    <p style="margin:0 0 16px;color:#64748b;">Another delivery partner has already accepted this request.</p>
    <p style="margin:0 0 8px;"><strong>Order:</strong> ${escapeHtml(ref)}</p>
    <p style="margin:0 0 8px;"><strong>Assigned to:</strong> ${escapeHtml(options.winningPartnerName)}</p>
  `;

  const textContent = [
    `Request no longer available.`,
    `Order: ${ref}`,
    `Assigned to: ${options.winningPartnerName}`,
    `Browse other requests: ${options.dashboardUrl}`,
  ].join('\n');

  const { html, text } = wrapEmail({
    title: subject,
    preheader,
    content,
    textContent,
    ctaText: 'Browse More Requests',
    ctaUrl: options.dashboardUrl,
    footerNote: 'This is an automated transactional email.',
  });

  return { subject, preheader, html, text };
}
