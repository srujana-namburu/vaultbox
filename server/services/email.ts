import nodemailer from 'nodemailer';
import { log } from '../vite';

// Email configuration
interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

// Create reusable transporter object using SMTP transport
const createTransporter = () => {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  };

  return nodemailer.createTransport(config);
};

interface EmailParams {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  attachments?: any[];
}

/**
 * Send an email using Nodemailer
 */
export async function sendEmail(params: EmailParams): Promise<boolean> {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    log('Cannot send email: SMTP credentials not set', 'email-service');
    return false;
  }

  try {
    const transporter = createTransporter();
    
    // Default from address if not provided
    const from = params.from || process.env.SMTP_FROM || 'noreply@vaultbox.app';
    
    await transporter.sendMail({
      from: from,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      attachments: params.attachments
    });
    
    log(`Email sent successfully to ${params.to}`, 'email-service');
    return true;
  } catch (error) {
    log(`Failed to send email: ${error instanceof Error ? error.message : String(error)}`, 'email-service');
    return false;
  }
}

/**
 * Send a notification email
 */
export async function sendNotificationEmail(
  to: string,
  subject: string,
  message: string,
  actionUrl?: string,
  actionText?: string
): Promise<boolean> {
  // Create a simple HTML template for the notification
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; padding: 20px; max-width: 600px; margin: 0 auto; }
        .container { background-color: #f9f9f9; border-radius: 8px; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">VaultBox</div>
        </div>
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${actionUrl && actionText ? `<a href="${actionUrl}" class="button">${actionText}</a>` : ''}
        </div>
        <div class="footer">
          <p>VaultBox - Secure Personal Vault</p>
          <p>This is an automated message, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject,
    text: message,
    html
  });
}

/**
 * Send a security alert email
 */
export async function sendSecurityAlertEmail(
  to: string,
  subject: string,
  message: string,
  details?: Record<string, string>
): Promise<boolean> {
  // Create HTML with details list if provided
  let detailsHtml = '';
  if (details && Object.keys(details).length > 0) {
    detailsHtml = '<ul style="background-color: #f5f5f5; padding: 15px; border-radius: 4px;">';
    for (const [key, value] of Object.entries(details)) {
      detailsHtml += `<li><strong>${key}:</strong> ${value}</li>`;
    }
    detailsHtml += '</ul>';
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${subject}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; padding: 20px; max-width: 600px; margin: 0 auto; }
        .container { background-color: #fff7f7; border: 1px solid #fee2e2; border-radius: 8px; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #dc2626; }
        .alert-icon { font-size: 36px; color: #dc2626; margin-bottom: 10px; }
        .content { margin-bottom: 20px; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #dc2626; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="alert-icon">⚠️</div>
          <div class="logo">VaultBox Security Alert</div>
        </div>
        <div class="content">
          <h2>${subject}</h2>
          <p>${message}</p>
          ${detailsHtml}
          <p>If you did not perform this action, please secure your account immediately.</p>
          <a href="https://vaultbox.app/security" class="button">Secure My Account</a>
        </div>
        <div class="footer">
          <p>VaultBox - Secure Personal Vault</p>
          <p>This is an automated security alert, please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `🔒 Security Alert: ${subject}`,
    text: message,
    html
  });
}

/**
 * Send a digest email with multiple notifications
 */
export async function sendDigestEmail(
  to: string, 
  notifications: Array<{title: string; message: string; timestamp: string; actionUrl?: string}>
): Promise<boolean> {
  if (notifications.length === 0) {
    return true; // No notifications to send
  }

  let notificationsHtml = '';
  notifications.forEach(notification => {
    notificationsHtml += `
      <div style="padding: 12px; border-bottom: 1px solid #eee; margin-bottom: 10px;">
        <h3 style="margin-top: 0; margin-bottom: 8px;">${notification.title}</h3>
        <p style="margin-top: 0; margin-bottom: 8px;">${notification.message}</p>
        <p style="color: #666; font-size: 12px; margin-top: 0; margin-bottom: 5px;">${notification.timestamp}</p>
        ${notification.actionUrl ? `<a href="${notification.actionUrl}" style="color: #2563eb;">View details</a>` : ''}
      </div>
    `;
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Your VaultBox Notification Digest</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.5; color: #333; padding: 20px; max-width: 600px; margin: 0 auto; }
        .container { background-color: #f9f9f9; border-radius: 8px; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
        .content { margin-bottom: 20px; }
        .notifications { background-color: white; border-radius: 8px; overflow: hidden; }
        .footer { font-size: 12px; color: #666; text-align: center; margin-top: 20px; }
        .button { display: inline-block; background-color: #2563eb; color: white; text-decoration: none; padding: 10px 20px; border-radius: 4px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">VaultBox</div>
        </div>
        <div class="content">
          <h2>Your Notification Digest</h2>
          <p>Here's a summary of recent activity in your VaultBox account:</p>
          <div class="notifications">
            ${notificationsHtml}
          </div>
        </div>
        <div class="footer">
          <p>VaultBox - Secure Personal Vault</p>
          <p>You received this email because you have digest notifications enabled.</p>
          <p><a href="https://vaultbox.app/notification-settings">Manage notification settings</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `VaultBox: Your ${notifications.length} new notification${notifications.length !== 1 ? 's' : ''}`,
    html
  });
}