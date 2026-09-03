import nodemailer from 'nodemailer';
import type { SendMailOptions } from 'nodemailer';

// ============================================================================
// EMAIL SERVICE - PRODUCTION GRADE
// ============================================================================
// This service is configured for maximum deliverability with SPF/DKIM/DMARC
// compatibility. It includes proper SMTP settings, headers, and error handling.
// ============================================================================

// Singleton transporter with production settings
let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const isSecure = process.env.SMTP_PORT === '465';

  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    throw new Error('SMTP_USER and SMTP_PASSWORD environment variables are required');
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: isSecure, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Production-grade connection settings
    connectionTimeout: parseInt(process.env.SMTP_CONNECTION_TIMEOUT || '30000', 10),
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT || '30000', 10),
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || '10000', 10),
    // Connection pooling for better performance
    pool: true,
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || '5', 10),
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || '100', 10),
    rateDelta: 1000,
    rateLimit: parseInt(process.env.SMTP_RATE_LIMIT || '5', 10), // emails per second
    // DKIM signing support if keys provided via environment
    dkim: process.env.DKIM_PRIVATE_KEY ? {
      domainName: process.env.DKIM_DOMAIN || process.env.SMTP_FROM_EMAIL?.split('@')[1] || 'getdelivery.com',
      keySelector: process.env.DKIM_KEY_SELECTOR || 'default',
      privateKey: process.env.DKIM_PRIVATE_KEY,
    } : undefined,
  });

  return transporter;
}

// Validate email format
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Normalize recipient email (trim whitespace, lowercase)
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// Remove duplicate recipients (DISABLED to allow testing multiple partners with the same email)
function deduplicateRecipients(recipients: string[]): string[] {
  // We used to deduplicate here, but if testing multiple partners with the same email,
  // this prevents them from getting their respective emails. So we return all valid emails.
  return recipients.filter((email) => validateEmail(normalizeEmail(email)));
}

// Simplified HTML to plain text conversion with semantic awareness
function htmlToPlainText(html: string): string {
  // Remove script and style tags and their content
  let text = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>.*?<\/style>/gi, '');
  
  // Replace common block elements with newlines
  text = text.replace(/<(p|div|blockquote|pre|table|tr|td|th|h[1-6])[\s>]/gi, '\n$&');
  text = text.replace(/<\/(p|div|blockquote|pre|table|tr|td|th|h[1-6])>/gi, '</\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '\n• ');
  
  // Remove all remaining HTML tags
  text = text.replace(/<[^>]*>/g, '');
  
  // Decode HTML entities
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
  
  // Clean up whitespace while preserving meaningful structure
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  return lines.join('\n\n');
}

// Determine sender authentication status (logs only, not enforcement)
function validateSenderAuthentication(): { warnings: string[] } {
  const warnings: string[] = [];
  const fromEmail = process.env.SMTP_FROM_EMAIL;
  const smtpUser = process.env.SMTP_USER;
  
  if (!fromEmail || !smtpUser) {
    warnings.push('WARNING: SMTP_FROM_EMAIL or SMTP_USER not configured');
    return { warnings };
  }

  const fromDomain = fromEmail.split('@')[1];
  const userDomain = smtpUser.split('@')[1];

  // SPF/DKIM require sender domain to match authenticated user domain
  if (fromDomain !== userDomain) {
    warnings.push(
      `WARNING: Sender domain (${fromDomain}) does not match authenticated user domain (${userDomain}). ` +
      `This may cause SPF/DKIM authentication to fail. Ensure SMTP_FROM_EMAIL and SMTP_USER use the same domain.`
    );
  }

  // Check for DNS authentication requirements
  if (!process.env.DKIM_PRIVATE_KEY) {
    warnings.push(
      `INFO: DKIM_PRIVATE_KEY not configured. Email deliverability depends on SPF/DMARC. ` +
      `To improve inbox placement, configure DKIM signing by setting DKIM_PRIVATE_KEY and DKIM_DOMAIN environment variables.`
    );
  }

  if (!process.env.DMARC_POLICY) {
    warnings.push(
      `INFO: DMARC policy not enforced. Ensure DNS DMARC record is configured: ` +
      `v=DMARC1; p=quarantine; rua=mailto:${process.env.SMTP_FROM_EMAIL || 'admin@domain.com'}`
    );
  }

  return { warnings };
}

// Log sender authentication warnings once on startup
let authWarningsLogged = false;
function logAuthenticationStatus() {
  if (authWarningsLogged) {
    return;
  }
  authWarningsLogged = true;
  const { warnings } = validateSenderAuthentication();
  if (warnings.length > 0) {
    console.log('\n╔════════════════════════════════════════════════════════════════╗');
    console.log('║           EMAIL AUTHENTICATION & DELIVERABILITY SETUP            ║');
    console.log('╠════════════════════════════════════════════════════════════════╣');
    warnings.forEach(w => {
      if (w.startsWith('WARNING')) {
        console.log('║ ⚠️  ' + w.padEnd(60) + ' ║');
      } else {
        console.log('║ ℹ️  ' + w.padEnd(60) + ' ║');
      }
    });
    console.log('╠════════════════════════════════════════════════════════════════╣');
    console.log('║ To PREVENT EMAILS FROM GOING TO SPAM:                          ║');
    console.log('║                                                                ║');
    console.log('║ 1. Configure SPF Record (DNS):                                 ║');
    console.log('║    v=spf1 include:sendgrid.net ~all                            ║');
    console.log('║    (or your email provider\'s SPF record)                       ║');
    console.log('║                                                                ║');
    console.log('║ 2. Configure DKIM (DNS + Environment):                         ║');
    console.log('║    - Set DKIM_PRIVATE_KEY environment variable                ║');
    console.log('║    - Set DKIM_DOMAIN to your sending domain                   ║');
    console.log('║    - Add DKIM public key to DNS                               ║');
    console.log('║                                                                ║');
    console.log('║ 3. Configure DMARC Policy (DNS):                               ║');
    console.log('║    v=DMARC1; p=quarantine; rua=mailto:admin@yourdomain.com    ║');
    console.log('║                                                                ║');
    console.log('║ 4. Ensure SMTP_FROM_EMAIL matches SMTP_USER domain:            ║');
    console.log('║    Both should be from the same domain (e.g., @yourdomain.com) ║');
    console.log('║                                                                ║');
    console.log('║ 5. Verify Sender Email in Gmail/Outlook:                       ║');
    console.log('║    - Add the sender email as a verified sender                 ║');
    console.log('║    - Confirm the verification email                            ║');
    console.log('╚════════════════════════════════════════════════════════════════╝\n');
  }
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  recipientsFailed?: string[];
}

// Retry logic for transient SMTP failures
async function sendWithRetry(
  mailOptions: SendMailOptions,
  maxRetries: number = 3
): Promise<SendEmailResult> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const transporter = getTransporter();
      const info = await transporter.sendMail(mailOptions);

      console.log(`✓ Email sent (attempt ${attempt}/${maxRetries}): ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: unknown) {
      lastError = error;
      const smtpError = error as {
        responseCode?: number;
        code?: string;
        message?: string;
        rejected?: string[];
      };
      const statusCode = smtpError.responseCode;

      const isRetryable =
        smtpError.code === 'ETIMEDOUT' ||
        smtpError.code === 'ECONNRESET' ||
        smtpError.code === 'ESOCKETTIMEDOUT' ||
        (statusCode && statusCode >= 400 && statusCode < 500 && statusCode !== 401 && statusCode !== 403);

      if (!isRetryable || attempt === maxRetries) {
        const errorMessage = smtpError.message || String(error);
        console.error(
          `✗ Email failed (attempt ${attempt}/${maxRetries}): ${errorMessage} ` +
          `(code: ${smtpError.code}, statusCode: ${statusCode})`
        );

        const rejectedRecipients = smtpError.rejected && smtpError.rejected.length > 0
          ? smtpError.rejected.map((recipient) => typeof recipient === 'string' ? recipient : String((recipient as { address?: string }).address || ''))
          : [];

        const recipientsFailed = rejectedRecipients.length > 0
          ? rejectedRecipients.filter(Boolean)
          : mailOptions.to instanceof Array
            ? mailOptions.to.filter((recipient): recipient is string => typeof recipient === 'string')
            : [String(mailOptions.to)];

        return {
          success: false,
          error: errorMessage,
          recipientsFailed,
        };
      }

      const delayMs = Math.min(1000 * attempt, 5000);
      console.warn(
        `⚠ Email send failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms: ${smtpError.message}`
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return {
    success: false,
    error: lastError instanceof Error ? lastError.message : 'Unknown error',
  };
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // Log authentication status once on first call
    logAuthenticationStatus();

    // Validate SMTP configuration
    if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
      console.error('✗ SMTP credentials not configured');
      return { 
        success: false, 
        error: 'SMTP credentials not configured in environment variables' 
      };
    }

    // Normalize and validate recipients
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const normalizedRecipients = recipients.map(normalizeEmail);
    const validRecipients = deduplicateRecipients(normalizedRecipients);

    if (validRecipients.length === 0) {
      console.error('✗ No valid recipient email addresses provided');
      return { success: false, error: 'No valid recipient email addresses provided' };
    }

    // Append invisible zero-width spaces to subject to prevent Gmail from threading separate notifications
    // We use a mix of zero-width characters to guarantee near-absolute uniqueness so Gmail never threads them.
    const zwChars = ['\u200B', '\u200C', '\u200D', '\uFEFF'];
    let zwsp = '';
    for (let i = 0; i < 12; i++) {
      zwsp += zwChars[Math.floor(Math.random() * zwChars.length)];
    }
    const uniqueSubject = `${options.subject}${zwsp}`;

    // Prepare sender information
    const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
    const fromName = process.env.SMTP_FROM_NAME || 'GETDelivery';
    const from = `"${fromName}" <${fromEmail}>`;
    const replyTo = options.replyTo || fromEmail;
    const sender = process.env.SMTP_USER; // Authenticated sender for SPF/DKIM

    // Verify sender domain matches authenticated user for SPF/DKIM to work
    const fromDomain = fromEmail.split('@')[1];
    const senderDomain = sender.split('@')[1];
    
    if (fromDomain !== senderDomain) {
      console.warn(
        `⚠ WARNING: Sender domain mismatch. From: ${fromDomain}, SMTP User: ${senderDomain}. ` +
        `This may cause SPF/DKIM to fail. For best deliverability, ensure SMTP_FROM_EMAIL matches SMTP_USER domain.`
      );
    }

    // Prepare text version if not provided
    const plainText = options.text || htmlToPlainText(options.html);

    // Prepare headers for maximum deliverability and spam avoidance
    // NOTE: Do NOT set Content-Type header here - let nodemailer auto-detect multipart/alternative
    // when both html and text are provided. Explicit Content-Type breaks multipart structure.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://getdelivery.com';
    const defaultHeaders: Record<string, string> = {
      'MIME-Version': '1.0',
      'X-Mailer': 'GETDelivery/1.0',
      'X-Priority': '3', // Normal priority
      'Importance': 'Normal',
      'X-MSMail-Priority': 'Normal',
      'X-Mailer-Version': '1.0',
      'List-Unsubscribe': `<${baseUrl}/unsubscribe>`, // Proper format for Gmail
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click', // Gmail's one-click unsubscribe
    };

    if (process.env.DKIM_PRIVATE_KEY) {
      defaultHeaders['X-Authentication-Info'] = `DKIM configured for ${senderDomain}`;
    }

    // Merge custom headers
    const headers = { ...defaultHeaders, ...options.headers };

    // Send emails individually to avoid exposing recipients and triggering spam filters
    const sendPromises = validRecipients.map(async (recipient) => {
      // Generate unique message ID for each email
      const uniqueMessageId = `<${Date.now()}.${Math.random().toString(36).substring(2, 15)}@${fromDomain}>`;

      // Build mail options with all required fields for deliverability
      const mailOptions: SendMailOptions = {
        from, // Display name and email
        to: recipient,
        sender, // Authenticated SMTP user for SPF/DKIM
        envelope: {
          from: fromEmail,
          to: recipient,
        },
        subject: uniqueSubject,
        html: options.html,
        text: plainText,
        replyTo,
        messageId: uniqueMessageId,
        date: new Date(),
        headers,
        priority: 'normal',
      };

      // Send with retry logic
      const result = await sendWithRetry(mailOptions);

      if (result.success) {
        // Log successful send
        console.log(
          `✓ Email delivered: From=${fromEmail}, To=${recipient}, ` +
          `Subject="${uniqueSubject}", MessageID=${result.messageId}`
        );
      }
      return result;
    });

    const results = await Promise.all(sendPromises);

    const hasSuccess = results.some(r => r.success);
    const failedResults = results.filter(r => !r.success);
    const recipientsFailed = failedResults.flatMap(r => r.recipientsFailed || []);
    
    // Return overall result
    return {
      success: hasSuccess,
      messageId: results.find(r => r.success)?.messageId, // Return first successful messageId
      error: failedResults.length > 0 ? `Failed for some recipients: ${failedResults.map(r => r.error).join(', ')}` : undefined,
      recipientsFailed: recipientsFailed.length > 0 ? recipientsFailed : undefined,
    };

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`✗ Unexpected email error: ${errorMessage}`);
    return { 
      success: false, 
      error: errorMessage 
    };
  }
}
