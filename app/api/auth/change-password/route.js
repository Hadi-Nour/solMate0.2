import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { jwtVerify } from 'jose';
import nodemailer from 'nodemailer';

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

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);

// Verify JWT and get user
async function getAuthUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

// Email transporter
function getEmailTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: parseInt(process.env.SMTP_PORT || '465') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

// Send password changed confirmation
async function sendPasswordChangedEmail(email, displayName) {
  const transporter = getEmailTransporter();
  if (!transporter) return false;
  
  const emailFrom = process.env.EMAIL_FROM || `PlaySolMates <${process.env.SMTP_USER}>`;

  try {
    await transporter.sendMail({
      from: emailFrom,
      to: email,
      subject: '✅ Your PlaySolMates password was changed',
      html: `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background: #1a1a2e; color: #fff; border-radius: 12px;">
          <h2>Password Changed</h2>
          <p>Hi ${displayName}, your password has been changed successfully.</p>
          <p style="color: #ef4444; font-size: 14px;">If you didn't make this change, please contact us immediately.</p>
          <p style="color: #888; font-size: 12px; margin-top: 20px;">© PlaySolMates</p>
        </div>
      `,
      text: `Hi ${displayName}, your PlaySolMates password has been changed. If you didn't make this change, please contact us immediately.`,
    });
    return true;
  } catch (error) {
    console.error('[Email] Failed to send confirmation:', error);
    return false;
  }
}

export async function POST(request) {
  try {
    const user = await getAuthUser(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
    
    const { currentPassword, newPassword } = await request.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required' },
        { status: 400 }
      );
    }
    
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'New password must be at least 8 characters' },
        { status: 400 }
      );
    }
    
    const db = await connectToMongo();
    
    // Find user
    const dbUser = await db.collection('users').findOne({
      $or: [
        { email: user.email?.toLowerCase() },
        { userId: user.userId },
      ]
    });
    
    if (!dbUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }
    
    // Verify current password
    if (!dbUser.password) {
      return NextResponse.json(
        { error: 'Your account uses social login and does not have a password. You can set one by using "Forgot Password" on the login page.' },
        { status: 400 }
      );
    }
    
    const isValid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }
    
    // Update password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    
    await db.collection('users').updateOne(
      { userId: dbUser.userId },
      {
        $set: {
          password: hashedPassword,
          updatedAt: new Date(),
        }
      }
    );
    
    // Send confirmation email
    if (dbUser.email) {
      await sendPasswordChangedEmail(dbUser.email, dbUser.displayName);
    }
    
    console.log(`[ChangePassword] Password changed for user: ${dbUser.email || dbUser.userId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Password changed successfully!',
    });
    
  } catch (error) {
    console.error('[ChangePassword] Error:', error);
    return NextResponse.json(
      { error: 'Failed to change password. Please try again.' },
      { status: 500 }
    );
  }
}
