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


  // Normalize wallet address coming from different clients:
  // - base58 (standard Solana)
  // - base64/base64url (some mobile / MWA clients like Seeker)
  function normalizeWallet(walletInput) {
    if (!walletInput || typeof walletInput !== 'string') {
      throw new Error('Invalid wallet');
    }
    const w = walletInput.trim();

    // base58
    try {
      const pk = bs58.decode(w);
      if (pk.length === 32) return { walletBase58: w, publicKeyBytes: pk, format: 'base58' };
    } catch (e) {}

    // base64/base64url
    let b64 = w.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) throw new Error('Invalid base64 length');

    const buf = Buffer.from(b64, 'base64');
    const pk = new Uint8Array(buf);
    if (pk.length !== 32) throw new Error('Invalid public key length (base64)');

    return { walletBase58: bs58.encode(pk), publicKeyBytes: pk, format: 'base64' };
  }

async function createToken(walletBase58) {
  return await new SignJWT({ wallet: walletBase58 })
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

      const nw = normalizeWallet(wallet);
      const walletBase58 = nw.walletBase58;
      const publicKeyBytes = nw.publicKeyBytes;
      console.log('[Wallet Verify] Wallet format:', nw.format, 'inputPreview:', String(wallet).substring(0, 16) + '...', 'base58:', walletBase58.substring(0, 8) + '...');

      const db = await connectToMongo();
      // Get nonce record
      const nonceRecord = await db.collection('nonces').findOne({
        nonce,
        wallet: walletBase58,
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
          // Robust decoding: supports base64, base64url (no padding), base58, hex
          console.log('[Wallet Verify] Signature preview:', signature.substring(0, 20) + '...');

          const decodeBase64Any = (sig) => {
            // Convert base64url -> base64 and pad to length % 4 == 0
            let b64 = sig.replace(/-/g, '+').replace(/_/g, '/');
            const pad = b64.length % 4;
            if (pad === 2) b64 += '==';
            else if (pad === 3) b64 += '=';
            else if (pad === 1) throw new Error('Invalid base64/base64url length');
            const buf = Buffer.from(b64, 'base64');
            return new Uint8Array(buf);
          };

          const decodeHex = (sig) => {
            const hex = sig.startsWith('0x') ? sig.slice(2) : sig;
            if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
              throw new Error('Invalid hex');
            }
            const out = new Uint8Array(hex.length / 2);
            for (let i = 0; i < hex.length; i += 2) {
              out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
            }
            return out;
          };

          const hasB64UrlChars = /[-_]/.test(signature);
          const hasB64Chars = /[+/=]/.test(signature);
          const b64urlCharset = /^[A-Za-z0-9\-_]+$/.test(signature);
          const mod4 = signature.length % 4;
          const b64urlLikely = b64urlCharset && (mod4 === 0 || mod4 === 2 || mod4 === 3);

          try {
            if (hasB64Chars || hasB64UrlChars || b64urlLikely) {
              signatureBytes = decodeBase64Any(signature);
              console.log('[Wallet Verify] Decoded as base64/base64url, length:', signatureBytes.length);
            } else {
              signatureBytes = bs58.decode(signature);
              console.log('[Wallet Verify] Decoded as base58, length:', signatureBytes.length);
            }
          } catch (e1) {
            // Fallback order: base64/base64url -> base58 -> hex
            try {
              signatureBytes = decodeBase64Any(signature);
              console.log('[Wallet Verify] Fallback decoded as base64/base64url, length:', signatureBytes.length);
            } catch (e2) {
              try {
                signatureBytes = bs58.decode(signature);
                console.log('[Wallet Verify] Fallback decoded as base58, length:', signatureBytes.length);
              } catch (e3) {
                signatureBytes = decodeHex(signature);
                console.log('[Wallet Verify] Fallback decoded as hex, length:', signatureBytes.length);
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
    let user = await db.collection('users').findOne({ wallet: walletBase58 });
    
    if (!user) {
      const newUser = {
        id: uuidv4(),
        wallet: walletBase58,
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
        { wallet: walletBase58 },
        { $set: { lastLoginAt: new Date() } }
      );
    }

    // Create JWT
    const token = await createToken(walletBase58);

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

  const response = NextResponse.json({
    success: true,
    token,
    user: safeUser
  });

// 🔐 Persist wallet login session (IMPORTANT)
response.cookies.set('solmate_session', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7, // 7 days
  path: '/',
  domain: '.playsolmates.app'
});

return handleCORS(response);

  } catch (error) {
    console.error('[Wallet Verify] Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    ));
  }
}
