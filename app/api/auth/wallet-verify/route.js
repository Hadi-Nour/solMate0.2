import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT } from 'jose';

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

// JWT Helper
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
);

async function createToken(wallet) {
  return await new SignJWT({ wallet })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

// Generate friend code
function generateFriendCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function POST(request) {
  try {
    const { wallet, nonce, signature } = await request.json();
    
    if (!wallet || !nonce || !signature) {
      return handleCORS(NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      ));
    }

    const db = await connectToMongo();

    // Get nonce record
    const nonceRecord = await db.collection('nonces').findOne({
      nonce,
      wallet,
      used: false
    });

    if (!nonceRecord) {
      return handleCORS(NextResponse.json(
        { error: 'Invalid or expired nonce' },
        { status: 401 }
      ));
    }

    if (new Date() > nonceRecord.expiresAt) {
      return handleCORS(NextResponse.json(
        { error: 'Nonce expired' },
        { status: 401 }
      ));
    }

    // Verify signature
    try {
      const message = new TextEncoder().encode(nonceRecord.message);
      let signatureBytes;
      
      console.log('[Wallet Verify] Signature input type:', typeof signature);
      console.log('[Wallet Verify] Signature length:', signature?.length);
      
      // Handle multiple signature formats from different wallets
      if (typeof signature === 'string') {
        // Preview first 20 chars for debugging (safe, no secrets)
        console.log('[Wallet Verify] Signature preview:', signature.substring(0, 20) + '...');
        
        // Check for base64 indicators FIRST (MWA/mobile wallets use base64)
        // Base64 may contain: + / = which are NOT valid base58 characters
        // Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
        const hasBase64Chars = /[+/=]/.test(signature);
        const looksLikeBase64 = signature.length % 4 === 0 && /^[A-Za-z0-9+/]+=*$/.test(signature);
        
        console.log('[Wallet Verify] Has base64 chars (+/=):', hasBase64Chars);
        console.log('[Wallet Verify] Looks like base64:', looksLikeBase64);
        
        if (hasBase64Chars || looksLikeBase64) {
          // Decode as base64 (standard or URL-safe)
          try {
            // Handle URL-safe base64 (replace - with + and _ with /)
            const standardBase64 = signature.replace(/-/g, '+').replace(/_/g, '/');
            signatureBytes = Uint8Array.from(atob(standardBase64), c => c.charCodeAt(0));
            console.log('[Wallet Verify] Decoded as base64, length:', signatureBytes.length);
          } catch (e64) {
            console.error('[Wallet Verify] Base64 decode failed:', e64.message);
            throw new Error('Failed to decode base64 signature');
          }
        } else {
          // Try base58 (Phantom desktop typically uses this)
          try {
            signatureBytes = bs58.decode(signature);
            console.log('[Wallet Verify] Decoded as base58, length:', signatureBytes.length);
          } catch (e58) {
            // Fallback: try base64 anyway
            try {
              signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
              console.log('[Wallet Verify] Fallback decoded as base64, length:', signatureBytes.length);
            } catch (e64) {
              // Last resort: try hex
              try {
                const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
                signatureBytes = Uint8Array.from(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                console.log('[Wallet Verify] Decoded as hex, length:', signatureBytes.length);
              } catch (eHex) {
                console.error('[Wallet Verify] All decode attempts failed');
                throw new Error('Could not decode signature - tried base58, base64, hex');
              }
            }
          }
        }
      } else if (Array.isArray(signature)) {
        // Handle array format (some wallets send as JSON array)
        signatureBytes = new Uint8Array(signature);
        console.log('[Wallet Verify] Converted from array, length:', signatureBytes.length);
      } else if (signature instanceof Uint8Array) {
        signatureBytes = signature;
        console.log('[Wallet Verify] Already Uint8Array, length:', signatureBytes.length);
      } else if (typeof signature === 'object' && signature?.data) {
        // Handle { data: [...] } format
        signatureBytes = new Uint8Array(signature.data);
        console.log('[Wallet Verify] Extracted from data property, length:', signatureBytes.length);
      } else {
        console.error('[Wallet Verify] Unknown signature type:', typeof signature);
        throw new Error('Invalid signature type');
      }
      
      // Validate signature length (Ed25519 signatures are 64 bytes)
      if (signatureBytes.length !== 64) {
        console.error('[Wallet Verify] Invalid signature length:', signatureBytes.length, '(expected 64)');
        return handleCORS(NextResponse.json(
          { error: `Invalid signature length: ${signatureBytes.length} bytes (expected 64)` },
          { status: 401 }
        ));
      }
      
      const publicKeyBytes = bs58.decode(wallet);
      console.log('[Wallet Verify] Public key length:', publicKeyBytes.length);
      
      const isValid = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
      console.log('[Wallet Verify] Verification result:', isValid);
      
      if (!isValid) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        ));
      }
    } catch (e) {
      console.error('[Wallet Verify] Signature verification error:', e.message);
      return handleCORS(NextResponse.json(
        { error: 'Signature verification failed: ' + e.message },
        { status: 401 }
      ));
    }

    // Mark nonce as used
    await db.collection('nonces').updateOne(
      { nonce },
      { $set: { used: true } }
    );

    // Find or create user
    let user = await db.collection('users').findOne({ wallet });
    
    if (!user) {
      const newUser = {
        id: uuidv4(),
        wallet,
        displayName: null,
        friendCode: generateFriendCode(),
        isVip: false,
        vipPurchasedAt: null,
        stats: {
          wins: 0,
          losses: 0,
          draws: 0,
          currentStreak: 0,
          bestStreak: 0,
          vipWins: 0,
          vipLosses: 0,
          vipCurrentStreak: 0,
          vipBestStreak: 0
        },
        chests: {
          bronze: 0,
          silver: 0,
          gold: 0
        },
        goldPoints: 0,
        shards: 0,
        inventory: ['piece_classic-wood', 'board_classic', 'avatar_default'],
        equipped: {
          piece: 'classic-wood',
          board: 'classic',
          avatar: 'default'
        },
        authProvider: 'wallet',
        createdAt: new Date(),
        lastLoginAt: new Date()
      };
      
      await db.collection('users').insertOne(newUser);
      user = newUser;
    } else {
      await db.collection('users').updateOne(
        { wallet },
        { $set: { lastLoginAt: new Date() } }
      );
    }

    // Create JWT
    const token = await createToken(wallet);

    // Return user data (without sensitive fields)
    const safeUser = {
      id: user.id,
      wallet: user.wallet,
      displayName: user.displayName,
      friendCode: user.friendCode,
      isVip: user.isVip,
      stats: user.stats,
      chests: user.chests,
      goldPoints: user.goldPoints,
      shards: user.shards,
      inventory: user.inventory,
      equipped: user.equipped,
      authProvider: user.authProvider || 'wallet'
    };

    return handleCORS(NextResponse.json({
      success: true,
      token,
      user: safeUser
    }));

  } catch (error) {
    console.error('[Wallet Verify] Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    ));
  }
}
