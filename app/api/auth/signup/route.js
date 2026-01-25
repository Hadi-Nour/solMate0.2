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

// Email transporter (Zoho SMTP)
function getEmailTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: {
      user: process.env.SMTP_USER || 'noreply@playsolmates.app',
      pass: process.env.SMTP_PASS,
    },
  });
}

// Generate verification token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send verification email
async function sendVerificationEmail(email, token, displayName) {
  const transporter = getEmailTransporter();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playsolmates.app';
  const verifyUrl = `${appUrl}/auth/verify?token=${token}`;

  const mailOptions = {
    from: `"PlaySolMates" <${process.env.SMTP_USER || 'noreply@playsolmates.app'}>`,
    to: email,
    subject: 'Verify your PlaySolMates account',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0b14; color: #ffffff; padding: 40px; }
          .container { max-width: 500px; margin: 0 auto; background: #1a1b26; border-radius: 16px; padding: 40px; }
          .logo { font-size: 28px; font-weight: bold; color: #14F195; margin-bottom: 24px; }
          h1 { font-size: 24px; margin-bottom: 16px; }
          p { color: #a0a0a0; line-height: 1.6; margin-bottom: 24px; }
          .button { display: inline-block; background: linear-gradient(135deg, #9945FF, #14F195); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; }
          .footer { margin-top: 32px; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">♟️ PlaySolMates</div>
          <h1>Welcome, ${displayName}!</h1>
          <p>Thanks for signing up for PlaySolMates - the Solana chess app. Please verify your email address to get started.</p>
          <a href="${verifyUrl}" class="button">Verify Email</a>
          <p style="margin-top: 24px; font-size: 14px;">Or copy this link: ${verifyUrl}</p>
          <div class="footer">
            <p>This link expires in 24 hours.</p>
            <p>If you didn't create a PlaySolMates account, please ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send verification email:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const { email, password, displayName } = await request.json();

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = generateToken();
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
      verificationToken,
      verificationTokenExpiry: tokenExpiry,
      createdAt: new Date(),
      updatedAt: new Date(),
      // Game data
      friends: [],
      stats: { wins: 0, losses: 0, draws: 0 },
      isVip: false,
    });

    // Send verification email
    const emailSent = await sendVerificationEmail(normalizedEmail, verificationToken, userDisplayName);

    if (!emailSent) {
      // Still create account but warn about email
      console.warn('[Signup] Account created but verification email failed to send');
    }

    return NextResponse.json({
      success: true,
      message: 'Account created! Please check your email to verify your account.',
      emailSent,
    });

  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
