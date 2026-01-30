import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { sendEmail } from '@/lib/email/transporter';

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

// ---- SEND WELCOME EMAIL (ONCE) ----
try {
  await sendEmail({
    to: user.email,
    subject: 'Welcome to PlaySolMates ♟️',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6">
        <p><b>Hello ${user.displayName || 'Player'},</b></p>

        <p>Welcome to <b>PlaySolMates</b> 👋<br/>
        We’re happy to have you join our community.</p>

        <p>Thank you for downloading the game and creating your account.<br/>
        We’re actively working on improving PlaySolMates and adding new features to deliver the best possible experience.</p>

        <p><b>Please note:</b><br/>
        The <b>VIP section is still under development</b> and is not yet finalized.<br/>
        If you choose to subscribe at this stage, it will be considered a <b>voluntary contribution</b> to support the continued development of the game and help us make PlaySolMates better for everyone.</p>

        <p>If you experience any issues or problems, please contact us at:<br/>
        <b>support@playsolmates.app</b></p>

        <p>If you have suggestions, ideas, or feedback, contact us at:<br/>
        <b>info@playsolmates.app</b></p>

        <p>Your opinion truly matters to us.</p>

        <p>Best regards,<br/>
        <b>The PlaySolMates Team</b></p>
      </div>
    `,
    text: `Hello ${user.displayName || 'Player'},

Welcome to PlaySolMates!
Thank you for downloading the game.

VIP is still under development. Any subscription is considered a voluntary contribution.

Support: support@playsolmates.app
Suggestions: info@playsolmates.app

The PlaySolMates Team
`
  });
} catch (e) {
  console.warn('[WelcomeEmail] failed:', e.message);
}


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
      from: `"PlaySolMates" <${process.env.SMTP_USER || 'noreply@playsolmates.app'}>`,
      to: normalizedEmail,
      subject: 'Verify your PlaySolMates account',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 40px; background: #1a1b26; color: #fff; border-radius: 16px;">
          <h1 style="color: #14F195;">♟️ PlaySolMates</h1>
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
