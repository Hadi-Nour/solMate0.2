import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { jwtVerify } from 'jose';

// MongoDB connection
let client;
let db;

async function connectToMongo() {
  if (db) return db;
  
  try {
    if (!client) {
      const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
      client = new MongoClient(mongoUrl);
      await client.connect();
    }
    
    db = client.db(process.env.DB_NAME || 'solmate');
    return db;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    client = null;
    db = null;
    throw error;
  }
}

// CORS Helper
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }));
}

// JWT verification
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

function getTokenFromRequest(request) {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

// Generate invite code (6 alphanumeric characters)
function generateInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0,O,1,I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// POST - Create a private match
export async function POST(request) {
  try {
    const token = getTokenFromRequest(request);
    if (!token) {
      return handleCORS(NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ));
    }

    const payload = await verifyToken(token);
    if (!payload?.wallet) {
      return handleCORS(NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      ));
    }

    const { action, code } = await request.json();

    const db = await connectToMongo();

    if (action === 'create') {
      // Check if user already has an active invite
      const existingInvite = await db.collection('private_matches').findOne({
        creatorWallet: payload.wallet,
        status: 'waiting',
        expiresAt: { $gt: new Date() }
      });

      if (existingInvite) {
        return handleCORS(NextResponse.json({
          success: true,
          code: existingInvite.code,
          expiresAt: existingInvite.expiresAt,
          message: 'Using existing invite code'
        }));
      }

      // Generate unique code
      let inviteCode;
      let attempts = 0;
      do {
        inviteCode = generateInviteCode();
        const existing = await db.collection('private_matches').findOne({ 
          code: inviteCode,
          status: { $in: ['waiting', 'matched'] }
        });
        if (!existing) break;
        attempts++;
      } while (attempts < 10);

      if (attempts >= 10) {
        return handleCORS(NextResponse.json(
          { error: 'Could not generate unique code. Please try again.' },
          { status: 500 }
        ));
      }

      const expiresAt = new Date(Date.now() + CODE_TTL_MS);

      await db.collection('private_matches').insertOne({
        code: inviteCode,
        creatorWallet: payload.wallet,
        joinerWallet: null,
        status: 'waiting', // waiting, matched, started, expired
        expiresAt,
        createdAt: new Date()
      });

      return handleCORS(NextResponse.json({
        success: true,
        code: inviteCode,
        expiresAt,
        ttlSeconds: CODE_TTL_MS / 1000
      }));

    } else if (action === 'join') {
      if (!code || code.length < 4) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid invite code' },
          { status: 400 }
        ));
      }

      const normalizedCode = code.toUpperCase().trim();

      // Find the invite
      const invite = await db.collection('private_matches').findOne({
        code: normalizedCode,
        status: 'waiting',
        expiresAt: { $gt: new Date() }
      });

      if (!invite) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid or expired invite code' },
          { status: 404 }
        ));
      }

      if (invite.creatorWallet === payload.wallet) {
        return handleCORS(NextResponse.json(
          { error: 'You cannot join your own match' },
          { status: 400 }
        ));
      }

      // Update to matched status
      await db.collection('private_matches').updateOne(
        { code: normalizedCode },
        { 
          $set: { 
            joinerWallet: payload.wallet,
            status: 'matched',
            matchedAt: new Date()
          } 
        }
      );

      return handleCORS(NextResponse.json({
        success: true,
        code: normalizedCode,
        creatorWallet: invite.creatorWallet,
        message: 'Joined private match!'
      }));

    } else if (action === 'check') {
      if (!code) {
        return handleCORS(NextResponse.json(
          { error: 'Code required' },
          { status: 400 }
        ));
      }

      const normalizedCode = code.toUpperCase().trim();

      const invite = await db.collection('private_matches').findOne({
        code: normalizedCode,
        $or: [
          { creatorWallet: payload.wallet },
          { joinerWallet: payload.wallet }
        ]
      });

      if (!invite) {
        return handleCORS(NextResponse.json(
          { error: 'Match not found' },
          { status: 404 }
        ));
      }

      return handleCORS(NextResponse.json({
        success: true,
        code: invite.code,
        status: invite.status,
        isCreator: invite.creatorWallet === payload.wallet,
        creatorWallet: invite.creatorWallet,
        joinerWallet: invite.joinerWallet,
        expiresAt: invite.expiresAt
      }));

    } else if (action === 'cancel') {
      if (!code) {
        return handleCORS(NextResponse.json(
          { error: 'Code required' },
          { status: 400 }
        ));
      }

      const normalizedCode = code.toUpperCase().trim();

      const result = await db.collection('private_matches').updateOne(
        { 
          code: normalizedCode, 
          creatorWallet: payload.wallet,
          status: 'waiting'
        },
        { $set: { status: 'cancelled' } }
      );

      if (result.modifiedCount === 0) {
        return handleCORS(NextResponse.json(
          { error: 'Could not cancel match' },
          { status: 400 }
        ));
      }

      return handleCORS(NextResponse.json({
        success: true,
        message: 'Match cancelled'
      }));

    } else {
      return handleCORS(NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      ));
    }

  } catch (error) {
    console.error('[Private Match] Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    ));
  }
}
