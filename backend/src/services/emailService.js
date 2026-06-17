'use strict';

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const logger = require('../utils/logger');

const config = {};
if (process.env.AWS_REGION) {
  config.region = process.env.AWS_REGION;
}
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  };
}

let sesClient = null;
try {
  // Only attempt to initialize if region is specified, otherwise fall back to mock
  if (config.region) {
    sesClient = new SESClient(config);
  }
} catch (err) {
  logger.error('Failed to initialize AWS SES Client', { error: err.message });
}

/**
 * Sends a single email via AWS SES. Falls back to logging in development.
 *
 * @param {object} opts
 * @param {string} opts.to      — Recipient email address
 * @param {string} opts.subject — Email subject line
 * @param {string} opts.html    — HTML body payload
 * @param {string} opts.text    — Plain-text fallback payload
 */
async function sendEmail({ to, subject, html, text }) {
  const sender = process.env.AWS_SES_SENDER || 'noreply@mediconnect.app';

  if (!sesClient || (!process.env.AWS_ACCESS_KEY_ID && process.env.AWS_REGION !== 'local-mock')) {
    logger.info(`[Email Mock] Sending email to ${to}: Subject: "${subject}"`);
    logger.info(`[Email Mock] Body: ${text || html}`);
    return { MessageId: `mock-msg-${Date.now()}` };
  }

  const command = new SendEmailCommand({
    Source: sender,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
        Charset: 'UTF-8',
      },
      Body: {
        Html: html ? { Data: html, Charset: 'UTF-8' } : undefined,
        Text: text
          ? { Data: text, Charset: 'UTF-8' }
          : { Data: html.replace(/<[^>]*>/g, ''), Charset: 'UTF-8' },
      },
    },
  });

  const response = await sesClient.send(command);
  logger.info(`Email sent to ${to} via SES. MessageId: ${response.MessageId}`);
  return response;
}

/**
 * Sends a structured password reset link email.
 */
async function sendPasswordResetEmail(email, token, hospitalCode) {
  const baseOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',');
  const baseOrigin = baseOrigins[0].trim();
  const resetLink = `${baseOrigin}/reset-password?token=${token}&email=${encodeURIComponent(email)}&hospitalCode=${hospitalCode}`;

  const subject = 'Reset Your MediConnect Password';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2b6cb0; text-align: center;">MediConnect Password Reset</h2>
      <p>Hello,</p>
      <p>We received a request to reset the password for your MediConnect account. Click the button below to choose a new password. This link will expire in 15 minutes.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
      </div>
      <p style="font-size: 12px; color: #718096; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.<br>
        Or copy and paste this link in your browser: <br>
        <span style="word-break: break-all; color: #3182ce;">${resetLink}</span>
      </p>
    </div>
  `;
  const text = `Reset your MediConnect password by visiting the following link (expires in 15 mins):\n\n${resetLink}`;

  return sendEmail({ to: email, subject, html, text });
}

/**
 * Sends structured notifications.
 */
async function sendAppointmentNotificationEmail(email, { title, body }) {
  const subject = title || 'MediConnect Notification';
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #2b6cb0; text-align: center;">MediConnect Notification</h2>
      <p>Hello,</p>
      <p>${body}</p>
      <p style="font-size: 12px; color: #718096; margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
        This is an automated notification from MediConnect. Please do not reply directly to this email.
      </p>
    </div>
  `;
  return sendEmail({ to: email, subject, html, text: body });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendAppointmentNotificationEmail,
};
