import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

// MongoDB connection
let client;
let db;

async function connectToMongo() {
  if (db) return db;
  
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'solmate');
  
  return db;
}

// Email transporter
function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '465');
  
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Generate reset token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send password reset email
async function sendPasswordResetEmail(email, token, displayName) {
  const transporter = getEmailTransporter();
  if (!transporter) return false;
  
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://playsolmates.app';
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
  const emailFrom = process.env.EMAIL_FROM || `PlaySolMates <${process.env.SMTP_USER}>`;

  const mailOptions = {
    from: emailFrom,
    to: email,
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
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send reset email:', error);
    return false;
  }
}

// Send password changed confirmation
async function sendPasswordChangedEmail(email, displayName) {
  const transporter = getEmailTransporter();
  if (!transporter) return false;
  
  const emailFrom = process.env.EMAIL_FROM || `PlaySolMates <${process.env.SMTP_USER}>`;

  const mailOptions = {
    from: emailFrom,
    to: email,
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
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send confirmation:', error);
    return false;
  }
}

// POST - Request password reset
export async function POST(request) {
  try {
    const { email, token, newPassword } = await request.json();
    
    const db = await connectToMongo();
    
    // If token and newPassword provided, this is the reset action
    if (token && newPassword) {
      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      
      const user = await db.collection('users').findOne({
        resetPasswordToken: token,
        resetPasswordExpiry: { $gt: new Date() },
      });
      
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid or expired reset link. Please request a new one.' },
          { status: 400 }
        );
      }
      
      // Update password
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      await db.collection('users').updateOne(
        { userId: user.userId },
        {
          $set: {
            password: hashedPassword,
            updatedAt: new Date(),
          },
          $unset: {
            resetPasswordToken: '',
            resetPasswordExpiry: '',
          }
        }
      );
      
      // Send confirmation email
      await sendPasswordChangedEmail(user.email, user.displayName);
      
      console.log(`[Reset] Password changed for user: ${user.email}`);
      
      return NextResponse.json({
        success: true,
        message: 'Password changed successfully! You can now log in.',
      });
    }
    
    // Request reset (email only)
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    const user = await db.collection('users').findOne({
      email: email.toLowerCase(),
    });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a reset link.',
      });
    }
    
    // Generate reset token
    const resetToken = generateToken();
    const resetExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await db.collection('users').updateOne(
      { userId: user.userId },
      {
        $set: {
          resetPasswordToken: resetToken,
          resetPasswordExpiry: resetExpiry,
          updatedAt: new Date(),
        }
      }
    );
    
    // Send reset email
    await sendPasswordResetEmail(user.email, resetToken, user.displayName);
    
    console.log(`[Reset] Password reset requested for: ${user.email}`);
    
    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a reset link.',
    });
    
  } catch (error) {
    console.error('[Reset] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process request. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - Verify reset token is valid
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    );
  }
  
  try {
    const db = await connectToMongo();
    
    const user = await db.collection('users').findOne({
      resetPasswordToken: token,
      resetPasswordExpiry: { $gt: new Date() },
    });
    
    if (!user) {
      return NextResponse.json(
        { valid: false, error: 'Invalid or expired reset link' },
        { status: 400 }
      );
    }
    
    return NextResponse.json({
      valid: true,
      email: user.email,
    });
    
  } catch (error) {
    console.error('[Reset] GET Error:', error);
    return NextResponse.json(
      { error: 'Failed to verify token' },
      { status: 500 }
    );
  }
}
