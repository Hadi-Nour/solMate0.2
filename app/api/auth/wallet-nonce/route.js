import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';

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

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(request) {
  try {
    const { wallet } = await request.json();
    
    if (!wallet) {
      return handleCORS(NextResponse.json(
        { error: 'Wallet address required' },
        { status: 400 }
      ));
    }

    const db = await connectToMongo();

    // Generate nonce
    const nonce = uuidv4();
    const timestamp = new Date().toISOString();
    const domain = request.headers.get('host') || 'solmate.app';
    
    const messageToSign = `PlaySolMates Authentication\n\nDomain: ${domain}\nWallet: ${wallet}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to verify wallet ownership.`;
    
    // Store nonce with expiry
    await db.collection('nonces').insertOne({
      nonce,
      wallet,
      message: messageToSign,
      expiresAt: new Date(Date.now() + NONCE_EXPIRY_MS),
      used: false,
      createdAt: new Date()
    });

    return handleCORS(NextResponse.json({
      nonce,
      messageToSign,
      expiresIn: NONCE_EXPIRY_MS / 1000
    }));

  } catch (error) {
    console.error('[Wallet Nonce] Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Failed to generate nonce' },
      { status: 500 }
    ));
  }
}
