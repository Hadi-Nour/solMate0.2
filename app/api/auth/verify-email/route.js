import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    const db = await connectToMongo();

    // Find user with this token
    const user = await db.collection('users').findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: 'Email already verified',
        alreadyVerified: true
      });
    }

    // Verify the email
    await db.collection('users').updateOne(
      { userId: user.userId },
      {
        $set: {
          emailVerified: true,
          updatedAt: new Date()
        },
        $unset: {
          verificationToken: '',
          verificationTokenExpiry: ''
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });

  } catch (error) {
    console.error('[Verify] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Resend verification email
export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const db = await connectToMongo();
    const normalizedEmail = email.toLowerCase();

    const user = await db.collection('users').findOne({ email: normalizedEmail });

    if (!user) {
      return NextResponse.json(
        { error: 'No account found with this email' },
        { status: 400 }
      );
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: 'Email is already verified' },
        { status: 400 }
      );
    }

    // Generate new token
    const crypto = await import('crypto');
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.collection('users').updateOne(
      { userId: user.userId },
      {
        $set: {
          verificationToken,
          verificationTokenExpiry: tokenExpiry,
          updatedAt: new Date()
        }
      }
    );

    // Import and send email
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.zoho.com',
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: true,
      auth: {
        user: process.env.SMTP_USER || 'noreply@playsolmates.app',
        pass: process.env.SMTP_PASS,
      },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playsolmates.app';
    const verifyUrl = `${appUrl}/auth/verify?token=${verificationToken}`;

    await transporter.sendMail({
      from: `"SolMate" <${process.env.SMTP_USER || 'noreply@playsolmates.app'}>`,
      to: normalizedEmail,
      subject: 'Verify your SolMate account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; background: #1a1b26; color: #fff; border-radius: 16px;">
          <h1 style="color: #14F195;">♟️ SolMate</h1>
          <p>Click the link below to verify your email:</p>
          <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #9945FF, #14F195); color: #000; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify Email</a>
          <p style="margin-top: 24px; font-size: 12px; color: #666;">This link expires in 24 hours.</p>
        </div>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Verification email sent',
    });

  } catch (error) {
    console.error('[Verify Resend] Error:', error);
    return NextResponse.json(
      { error: 'Failed to resend verification email' },
      { status: 500 }
    );
  }
}
