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

// Generate reset token
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Send password reset email
async function sendPasswordResetEmail(email, token, displayName) {
  const appUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXTAUTH_URL || 'https://playsolmates.app';
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;
  
  const template = emailTemplates.passwordReset(displayName, resetUrl);
  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  
  return result.success;
}

// Send password changed confirmation
async function sendPasswordChangedEmail(email, displayName) {
  const template = emailTemplates.passwordChanged(displayName);
  const result = await sendEmail({
    to: email,
    subject: template.subject,
    html: template.html,
    text: template.text,
  });
  
  return result.success;
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
