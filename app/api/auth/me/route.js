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

export async function GET(request) {
  try {
    const token = getTokenFromRequest(request);
    
    if (!token) {
      console.log('[Auth/Me] No token provided');
      return handleCORS(NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      ));
    }

    const payload = await verifyToken(token);
    
    if (!payload?.wallet) {
      console.log('[Auth/Me] Invalid token');
      return handleCORS(NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      ));
    }

    const db = await connectToMongo();
    const user = await db.collection('users').findOne({ wallet: payload.wallet });
    
    if (!user) {
      console.log('[Auth/Me] User not found for wallet:', payload.wallet);
      return handleCORS(NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      ));
    }

    console.log('[Auth/Me] User found:', user.wallet, 'email:', user.email || 'none');

    return handleCORS(NextResponse.json({
      user: {
        id: user.id,
        wallet: user.wallet,
        email: user.email || null,
        provider: user.provider || null,
        displayName: user.displayName || null,
        friendCode: user.friendCode,
        isVip: user.isVip,
        stats: user.stats,
        chests: user.chests,
        goldPoints: user.goldPoints,
        shards: user.shards,
        inventory: user.inventory,
        equipped: user.equipped
      }
    }));

  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    ));
  }
}
