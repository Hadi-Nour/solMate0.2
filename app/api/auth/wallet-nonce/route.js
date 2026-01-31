import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import bs58 from 'bs58';
import { v4 as uuidv4 } from 'uuid';


// Normalize wallet address coming from different clients:
// - base58 (standard Solana address)
// - base64/base64url (some mobile/MWA clients like Seeker)
function normalizeWallet(walletInput) {
  if (!walletInput || typeof walletInput !== 'string') {
    throw new Error('Invalid wallet');
  }

  const w = walletInput.trim();

  // Try base58 first
  try {
    const pk = bs58.decode(w);
    if (pk.length === 32) {
      return { walletBase58: w, publicKeyBytes: pk, format: 'base58' };
    }
  } catch (e) {}

  // Try base64/base64url -> convert to base58
  let b64 = w.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4;
  if (pad === 2) b64 += '==';
  else if (pad === 3) b64 += '=';
  else if (pad === 1) throw new Error('Invalid base64 length');

  const buf = Buffer.from(b64, 'base64');
  const pk = new Uint8Array(buf);

  if (pk.length !== 32) {
    throw new Error('Invalid public key length (base64)');
  }

  return { walletBase58: bs58.encode(pk), publicKeyBytes: pk, format: 'base64' };
}

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

      const nw = normalizeWallet(wallet);
      const walletBase58 = nw.walletBase58;
      console.log('[Wallet Nonce] Wallet format:', nw.format, 'inputPreview:', String(wallet).substring(0, 16) + '...', 'base58:', walletBase58.substring(0, 8) + '...');
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
    
    const messageToSign = `PlaySolMates Authentication\n\nDomain: ${domain}\nWallet: ${walletBase58}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to verify wallet ownership.`;
    
    // Store nonce with expiry
    await db.collection('nonces').insertOne({
      nonce,
      wallet: walletBase58,
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
