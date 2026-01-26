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
    console.error('[Email] SMTP not configured');
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

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate verification token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email with OTP and link
async function sendVerificationEmail(email, otp, token, displayName) {
  const transporter = getEmailTransporter();
  if (!transporter) {
    console.error('[Email] Transporter not available');
    return false;
  }
  
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://playsolmates.app';
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;
  const emailFrom = process.env.EMAIL_FROM || `PlaySolMates <${process.env.SMTP_USER}>`;

  const mailOptions = {
    from: emailFrom,
    to: email,
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
              <!-- Logo/Header -->
              <div style="margin-bottom: 32px;">
                <h1 style="color: #ffffff; font-size: 32px; margin: 0;">
                  ♟️ <span style="background: linear-gradient(135deg, #9333ea, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">PlaySolMates</span>
                </h1>
                <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Chess on Solana</p>
              </div>
              
              <!-- Main Card -->
              <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
                <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                  Welcome, ${displayName}! 🎉
                </h2>
                
                <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                  Thanks for signing up! Use the code below to verify your email, or click the button.
                </p>
                
                <!-- OTP Code Box -->
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
                
                <!-- Verify Button -->
                <div style="text-align: center; margin: 24px 0;">
                  <a href="${verifyUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                    ✨ Verify Email & Sign In
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 12px; text-align: center; margin: 24px 0 0 0;">
                  If you didn't create a PlaySolMates account, please ignore this email.
                </p>
              </div>
              
              <!-- Footer -->
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
  };

  try {
    const result = await transporter.sendMail(mailOptions);
    console.log('[Email] Verification email sent:', result.messageId);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const { email, password, displayName, agreedToTerms } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Terms & Conditions check
    if (!agreedToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the Terms & Conditions' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      );
    }

    const db = await connectToMongo();
    const normalizedEmail = email.toLowerCase();

    // Check if user exists
    const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
    if (existingUser) {
      // If user exists but not verified, allow resend
      if (!existingUser.emailVerified) {
        // Generate new OTP and token
        const otp = generateOTP();
        const verificationToken = generateToken();
        const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await db.collection('users').updateOne(
          { email: normalizedEmail },
          {
            $set: {
              otp,
              otpExpiry,
              verificationToken,
              verificationTokenExpiry: tokenExpiry,
              updatedAt: new Date(),
            }
          }
        );
        
        const emailSent = await sendVerificationEmail(normalizedEmail, otp, verificationToken, existingUser.displayName);
        
        return NextResponse.json({
          success: true,
          message: 'Verification code resent! Check your email.',
          emailSent,
          requiresVerification: true,
        });
      }
      
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate OTP (6 digits) and verification token
    const otp = generateOTP();
    const verificationToken = generateToken();
    const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userDisplayName = displayName || normalizedEmail.split('@')[0];

    await db.collection('users').insertOne({
      userId,
      email: normalizedEmail,
      password: hashedPassword,
      displayName: userDisplayName,
      authProvider: 'email',
      emailVerified: false,
      otp,
      otpExpiry,
      verificationToken,
      verificationTokenExpiry: tokenExpiry,
      agreedToTerms: true,
      agreedToTermsAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      // Game data
      friends: [],
      stats: { wins: 0, losses: 0, draws: 0 },
      isVip: false,
    });

    // Send verification email with OTP and link
    const emailSent = await sendVerificationEmail(normalizedEmail, otp, verificationToken, userDisplayName);

    if (!emailSent) {
      console.warn('[Signup] Account created but verification email failed to send');
    }

    return NextResponse.json({
      success: true,
      message: 'Account created! Check your email for the verification code.',
      emailSent,
      requiresVerification: true,
    });

  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
