import nodemailer from 'nodemailer';

/**
 * Production-ready email transporter for PlaySolMates
 * Supports both Zoho SMTP configurations:
 * - Port 465 (SSL/TLS) - secure: true
 * - Port 587 (STARTTLS) - secure: false with requireTLS
 */

// Safe logging helper - never logs secrets
function logEmailConfig() {
  const config = {
    host: process.env.SMTP_HOST || 'NOT_SET',
    port: process.env.SMTP_PORT || 'NOT_SET',
    user: process.env.SMTP_USER || 'NOT_SET',
    from: process.env.EMAIL_FROM || 'NOT_SET',
    hasPassword: !!process.env.SMTP_PASS,
  };
  console.log('[Email] Config:', JSON.stringify(config));
  return config;
}

// Create email transporter with proper TLS/SSL support
export function createEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587');
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Validate required env vars
  if (!host || !user || !pass) {
    const config = logEmailConfig();
    console.error('[Email] Missing required SMTP configuration');
    return null;
  }

  // Log config (safe - no secrets)
  console.log(`[Email] Creating transporter: host=${host}, port=${port}, user=${user}`);

  // Configure based on port
  // Port 465 = SSL (secure: true)
  // Port 587 = STARTTLS (secure: false, but upgrade to TLS)
  const isSSL = port === 465;
  
  const transportConfig = {
    host,
    port,
    secure: isSSL, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
    // For port 587 (STARTTLS), we need these options
    ...(port === 587 && {
      requireTLS: true,
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false, // Allow self-signed certs in dev
      },
    }),
    // Connection timeout
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000,
    socketTimeout: 15000,
  };

  return nodemailer.createTransport(transportConfig);
}

// Send email with proper error handling and logging
export async function sendEmail({ to, subject, html, text }) {
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    return { success: false, error: 'SMTP not configured' };
  }

  const from = process.env.EMAIL_FROM || `PlaySolMates <${process.env.SMTP_USER}>`;

  try {
    console.log(`[Email] Sending to: ${to}, subject: "${subject}"`);
    
    const result = await transporter.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });

    console.log(`[Email] Sent successfully: messageId=${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    // Safe error logging - no secrets
    console.error(`[Email] Failed to send:`, {
      code: error.code,
      message: error.message,
      responseCode: error.responseCode,
      command: error.command,
    });
    return { 
      success: false, 
      error: error.message,
      code: error.code,
      responseCode: error.responseCode,
    };
  } finally {
    // Close transporter
    transporter.close();
  }
}

// Verify SMTP connection (for health checks)
export async function verifyEmailConnection() {
  const transporter = createEmailTransporter();
  
  if (!transporter) {
    return { connected: false, error: 'SMTP not configured' };
  }

  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified successfully');
    transporter.close();
    return { connected: true };
  } catch (error) {
    console.error('[Email] SMTP verification failed:', {
      code: error.code,
      message: error.message,
    });
    transporter.close();
    return { 
      connected: false, 
      error: error.message,
      code: error.code,
    };
  }
}

// Email templates
export const emailTemplates = {
  verification: (displayName, otp, verifyUrl) => ({
    subject: '🔐 Verify your PlaySolMates account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Verify your PlaySolMates account</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td align="center">
              <div style="margin-bottom: 32px;">
                <h1 style="color: #ffffff; font-size: 32px; margin: 0;">
                  ♟️ <span style="background: linear-gradient(135deg, #9333ea, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">PlaySolMates</span>
                </h1>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Chess on Solana</p>
              </div>
              
              <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Welcome, ${displayName}! 🎉
                </h2>
                
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Thanks for signing up! Use the code below to verify your email, or click the button.
                </p>
                
                <div style="background: #0f0f23; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
                  <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your verification code</p>
                  <div style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #14F195; font-family: monospace;">
                    ${otp}
                  </div>
                  <p style="color: #6b7280; font-size: 12px; margin: 8px 0 0 0;">Expires in 15 minutes</p>
                </div>
                
                <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 16px 0;">
                  — or —
                </p>
                
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${verifyUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                    ✨ Verify Email & Sign In
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
                  If you didn't create a PlaySolMates account, please ignore this email.
                </p>
              </div>
              
              <div style="margin-top: 32px; text-align: center;">
                <p style="color: #6b7280; font-size: 12px; margin: 0;">
                  © ${new Date().getFullYear()} PlaySolMates. All rights reserved.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Welcome to PlaySolMates, ${displayName}!\n\nYour verification code is: ${otp}\n\nOr click this link to verify: ${verifyUrl}\n\nThis code expires in 15 minutes.\n\nIf you didn't create this account, please ignore this email.`,
  }),

  
    
    welcome: (displayName) => {
      const appUrl = process.env.BASE_URL || 'https://playsolmates.app';
      const safeName = displayName || 'Player';

      return {
        subject: '👋 Welcome to PlaySolMates!',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to PlaySolMates</title>
          </head>
          <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
              <tr>
                <td align="center">
                  <div style="margin-bottom: 32px;">
                    <h1 style="color: #ffffff; font-size: 32px; margin: 0;">
                      ♟️ <span style="background: linear-gradient(135deg, #9333ea, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">PlaySolMates</span>
                    </h1>
                    <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Chess on Solana</p>
                  </div>

                  <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
                    <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 14px 0; text-align: center;">
                      Welcome, ${safeName}! 🎉
                    </h2>

                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.7; margin: 0 0 18px 0; text-align: center;">
                      Thanks for downloading <strong>PlaySolMates</strong> and joining our community.
                    </p>

                    <div style="background: #0f0f23; border-radius: 12px; padding: 18px; margin: 18px 0; text-align: left;">
                      <p style="color: #a1a1aa; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">
                        VIP (Important Note)
                      </p>
                      <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0;">
                        The <strong>VIP</strong> section is still under development and not finished yet.
                        Please <strong>do not subscribe</strong> at the moment.
                        If you do subscribe, it will be considered a <strong>donation</strong> to support development.
                      </p>
                    </div>

                    <div style="text-align: center; margin: 24px 0;">
                      <a href="${appUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                        🎮 Start Playing
                      </a>
                    </div>

                    <div style="text-align: left; margin-top: 18px;">
                      <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0 0 10px 0;">
                        Issues / questions:
                        <a href="mailto:support@playsolmates.app" style="color: #60a5fa; text-decoration: none;">support@playsolmates.app</a>
                      </p>
                      <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0;">
                        Suggestions / ideas:
                        <a href="mailto:info@playsolmates.app" style="color: #60a5fa; text-decoration: none;">info@playsolmates.app</a>
                      </p>
                      <p style="color: #9ca3af; font-size: 13px; margin-top: 14px;">
                        Your feedback matters to us.
                      </p>
                    </div>
                  </div>

                  <div style="margin-top: 32px; text-align: center;">
                    <p style="color: #6b7280; font-size: 12px; margin: 0;">
                      © ${new Date().getFullYear()} PlaySolMates. All rights reserved.
                    </p>
                  </div>
                </td>
              </tr>
            </table>
          </body>
          </html>
        `,
        text: `Hello ${safeName},\n\nWelcome to PlaySolMates!\n\nThanks for downloading the game and joining our community.\n\nVIP Note: VIP is still under development. Please do not subscribe yet. If you do, it will be considered a donation.\n\nStart playing: ${appUrl}\n\nSupport: support@playsolmates.app\nSuggestions: info@playsolmates.app\n\nBest regards,\nThe PlaySolMates Team`,
      };
    },
    passwordReset: (displayName, resetUrl) => ({
    subject: '🔑 Reset your PlaySolMates password',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td align="center">
              <div style="margin-bottom: 32px;">
                <h1 style="color: #ffffff; font-size: 32px; margin: 0;">♟️ PlaySolMates</h1>
              </div>
              
              <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Password Reset Request
                </h2>
                
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Hi ${displayName}, we received a request to reset your password. Click the button below to create a new password.
                </p>
                
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600;">
                    🔑 Reset Password
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; text-align: center;">
                  This link expires in 1 hour.
                </p>
                
                <p style="color: #6b7280; font-size: 12px; text-align: center; margin-top: 24px;">
                  If you didn't request this, please ignore this email. Your password will remain unchanged.
                </p>
              </div>
              
              <div style="margin-top: 32px; text-align: center;">
                <p style="color: #6b7280; font-size: 12px;">© ${new Date().getFullYear()} PlaySolMates</p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${displayName},\n\nWe received a request to reset your PlaySolMates password.\n\nClick this link to reset: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.`,
  }),

  passwordChanged: (displayName) => ({
    subject: '✅ Your PlaySolMates password was changed',
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, sans-serif;">
        <table width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <tr>
            <td align="center">
              <div style="margin-bottom: 32px;">
                <h1 style="color: #ffffff; font-size: 32px; margin: 0;">♟️ PlaySolMates</h1>
              </div>
              
              <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
                <div style="text-align: center; margin-bottom: 24px;">
                  <span style="font-size: 48px;">✅</span>
                </div>
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Password Changed Successfully
                </h2>
                
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; text-align: center;">
                  Hi ${displayName}, your password has been changed successfully. You can now log in with your new password.
                </p>
                
                <p style="color: #ef4444; font-size: 14px; text-align: center; margin-top: 24px;">
                  If you didn't make this change, please contact us immediately.
                </p>
              </div>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `Hi ${displayName},\n\nYour PlaySolMates password has been changed successfully.\n\nIf you didn't make this change, please contact us immediately.`,
  }),
};
