import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { SignJWT } from 'jose';

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

// JWT Secret - must match across all auth endpoints
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

// Generate JWT token for auto-login after verification
async function generateAuthToken(user) {
  const token = await new SignJWT({
    wallet: user.wallet || user.email,
    email: user.email,
    userId: user.userId,
    displayName: user.displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
  
  return token;
}

export async function POST(request) {
  try {
    const { email, otp, token } = await request.json();
    
    const db = await connectToMongo();
    
    let user = null;
    
    // Verify by OTP
    if (email && otp) {
      user = await db.collection('users').findOne({
        email: email.toLowerCase(),
        otp: otp,
        otpExpiry: { $gt: new Date() },
      });
      
      if (!user) {
        // Check if OTP expired
        const expiredUser = await db.collection('users').findOne({
          email: email.toLowerCase(),
          otp: otp,
        });
        
        if (expiredUser) {
          return NextResponse.json(
            { error: 'Verification code has expired. Please request a new one.' },
            { status: 400 }
          );
        }
        
        return NextResponse.json(
          { error: 'Invalid verification code' },
          { status: 400 }
        );
      }
    }
    // Verify by token (from email link)
    else if (token) {
      user = await db.collection('users').findOne({
        verificationToken: token,
        verificationTokenExpiry: { $gt: new Date() },
      });
      
      if (!user) {
        return NextResponse.json(
          { error: 'Invalid or expired verification link' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Please provide email and OTP code, or use the verification link' },
        { status: 400 }
      );
    }
    
    // Mark email as verified
    await db.collection('users').updateOne(
      { userId: user.userId },
      {
        $set: {
          emailVerified: true,
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          otp: '',
          otpExpiry: '',
          verificationToken: '',
          verificationTokenExpiry: '',
        }
      }
    );
    
    // Generate auth token for auto-login
    const authToken = await generateAuthToken(user);
    
    console.log(`[Verify] Email verified for user: ${user.email}`);
    
    return NextResponse.json({
      success: true,
      message: 'Email verified successfully!',
      authToken,
      user: {
        userId: user.userId,
        email: user.email,
        displayName: user.displayName,
        isVip: user.isVip || false,
      },
    });
    
  } catch (error) {
    console.error('[Verify] Error:', error);
    return NextResponse.json(
      { error: 'Verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

// GET for link-based verification (redirects to frontend)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  
  if (!token) {
    return NextResponse.redirect(new URL('/auth/verify-email?error=missing_token', request.url));
  }
  
  try {
    const db = await connectToMongo();
    
    const user = await db.collection('users').findOne({
      verificationToken: token,
      verificationTokenExpiry: { $gt: new Date() },
    });
    
    if (!user) {
      return NextResponse.redirect(new URL('/auth/verify-email?error=invalid_token', request.url));
    }
    
    // Mark email as verified
    await db.collection('users').updateOne(
      { userId: user.userId },
      {
        $set: {
          emailVerified: true,
          lastLogin: new Date(),
          updatedAt: new Date(),
        },
        $unset: {
          otp: '',
          otpExpiry: '',
          verificationToken: '',
          verificationTokenExpiry: '',
        }
      }
    );
    
    // Generate auth token
    const authToken = await generateAuthToken(user);
    
    console.log(`[Verify] Email verified via link for user: ${user.email}`);
    
    // Redirect to frontend with token for auto-login
    return NextResponse.redirect(new URL(`/auth/verify-email?success=true&token=${authToken}`, request.url));
    
  } catch (error) {
    console.error('[Verify] GET Error:', error);
    return NextResponse.redirect(new URL('/auth/verify-email?error=server_error', request.url));
  }
}
