import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { sendEmail, emailTemplates } from '@/lib/email/transporter';

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
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://playsolmates.app';
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;
  
  const template = emailTemplates.verification(displayName, otp, verifyUrl);
  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  
  return result.success;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, displayName, agreedToTerms, resendOnly } = body;

    // Handle resend-only request (for unverified users redirected from login)
    if (resendOnly && email) {
      const db = await connectToMongo();
      const normalizedEmail = email.toLowerCase();
      const existingUser = await db.collection('users').findOne({ email: normalizedEmail });
      
      if (!existingUser) {
        return NextResponse.json(
          { error: 'No account found with this email' },
          { status: 400 }
        );
      }
      
      if (existingUser.emailVerified) {
        return NextResponse.json(
          { error: 'Email already verified. Please login.' },
          { status: 400 }
        );
      }
      
      // Generate new OTP and token
      const otp = generateOTP();
      const token = generateToken();
      const otpExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      
      await db.collection('users').updateOne(
        { email: normalizedEmail },
        {
          $set: {
            verificationOtp: otp,
            verificationToken: token,
            verificationExpires: otpExpires,
          }
        }
      );
      
      // Send verification email
      const emailSent = await sendVerificationEmail(
        normalizedEmail, 
        otp, 
        token, 
        existingUser.displayName || normalizedEmail.split('@')[0]
      );
      
      console.log(`[Signup] Resent verification to ${normalizedEmail}, emailSent: ${emailSent}`);
      
      return NextResponse.json({
        success: true,
        message: 'Verification code sent! Check your email.',
        emailSent,
        requiresVerification: true,
      });
    }

    // Regular signup flow
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
