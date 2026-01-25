import { MongoClient, ObjectId } from 'mongodb';
import { v4 as uuidv4 } from 'uuid';
import { NextResponse } from 'next/server';
import { Chess } from 'chess.js';
import nacl from 'tweetnacl';
import bs58 from 'bs58';
import { SignJWT, jwtVerify } from 'jose';
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getBotMove, validateMove, getGameStatus } from '@/lib/chess/engine';
import { openChest, getAllCosmetics, CHEST_DROP_RATES } from '@/lib/cosmetics';

// Constants - All values from environment (no hardcoded fallbacks in production)
const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET);
if (!process.env.JWT_SECRET) {
  console.error('[CRITICAL] JWT_SECRET environment variable is not set!');
}

const NONCE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const VIP_PRICE_USDC = parseFloat(process.env.VIP_PRICE_USDC || '6.99');
const USDC_DECIMALS = 6;
const VIP_PRICE_USDC_RAW = BigInt(Math.round(VIP_PRICE_USDC * Math.pow(10, USDC_DECIMALS))); // 6990000

// Payment configuration - MUST be set in production
const DEVELOPER_WALLET = process.env.DEVELOPER_WALLET || process.env.NEXT_PUBLIC_DEVELOPER_WALLET;
const RPC_URL = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC_URL;
const CLUSTER = process.env.SOLANA_CLUSTER || process.env.NEXT_PUBLIC_SOLANA_CLUSTER;

// USDC Mint addresses
const USDC_MINT = CLUSTER === 'mainnet-beta' 
  ? process.env.USDC_MINT_MAINNET || process.env.NEXT_PUBLIC_USDC_MINT_MAINNET
  : process.env.USDC_MINT_DEVNET || process.env.NEXT_PUBLIC_USDC_MINT_DEVNET;

// Validate critical payment config on startup
const validatePaymentConfig = () => {
  const missing = [];
  if (!DEVELOPER_WALLET) missing.push('DEVELOPER_WALLET');
  if (!RPC_URL) missing.push('RPC_URL');
  if (!CLUSTER) missing.push('SOLANA_CLUSTER');
  if (!USDC_MINT) missing.push(CLUSTER === 'mainnet-beta' ? 'USDC_MINT_MAINNET' : 'USDC_MINT_DEVNET');
  
  if (missing.length > 0) {
    console.warn(`[Payment] Missing configuration: ${missing.join(', ')}`);
    return false;
  }
  
  console.log(`[Payment] Config loaded: cluster=${CLUSTER}, wallet=${DEVELOPER_WALLET?.slice(0,8)}...`);
  return true;
};

const PAYMENT_CONFIG_VALID = validatePaymentConfig();

// MongoDB connection
let client;
let db;

async function connectToMongo() {
  if (db) return db;
  
  try {
    if (!client) {
      const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
      console.log('[MongoDB] Connecting to:', mongoUrl.replace(/\/\/.*@/, '//***@'));
      client = new MongoClient(mongoUrl);
      await client.connect();
      console.log('[MongoDB] Connected successfully');
    }
    
    db = client.db(process.env.DB_NAME || 'solmate');
    
    // Initialize indexes (only on first connect)
    try {
      await db.collection('users').createIndex({ wallet: 1 }, { unique: true, sparse: true });
      await db.collection('users').createIndex({ friendCode: 1 }, { unique: true, sparse: true });
      await db.collection('nonces').createIndex({ nonce: 1 }, { unique: true });
      await db.collection('nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      await db.collection('transactions').createIndex({ signature: 1 }, { unique: true });
      await db.collection('matches').createIndex({ id: 1 }, { unique: true });
      await db.collection('friends').createIndex({ wallet: 1, friendWallet: 1 }, { unique: true });
    } catch (indexError) {
      // Indexes might already exist, that's okay
      console.log('[MongoDB] Index creation (may already exist):', indexError.message);
    }
    
    return db;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    // Reset client on error to allow retry
    client = null;
    db = null;
    throw error;
  }
}

// Solana Connection
function getSolanaConnection() {
  return new Connection(RPC_URL, 'confirmed');
}

// CORS Helper
function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  return response;
}

// JWT Helpers
async function createToken(wallet) {
  return await new SignJWT({ wallet })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
}

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
  const cookies = request.headers.get('cookie') || '';
  const match = cookies.match(/solmate_session=([^;]+)/);
  return match ? match[1] : null;
}

async function requireAuth(request) {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return await verifyToken(token);
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

// OPTIONS handler
export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }));
}

// Route handler
async function handleRoute(request, { params }) {
  const { path = [] } = params;
  const route = `/${path.join('/')}`;
  const method = request.method;

  let db;
  try {
    db = await connectToMongo();
  } catch (dbError) {
    console.error('[API] Database connection failed:', dbError.message);
    return handleCORS(NextResponse.json(
      { error: 'Database connection failed. Please try again.' },
      { status: 503 }
    ));
  }

  try {

    // ============================================
    // ROOT ENDPOINTS
    // ============================================
    
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({
        message: 'SolMate API',
        version: '1.0.0',
        cluster: CLUSTER
      }));
    }

    // ============================================
    // AUTH ENDPOINTS
    // ============================================

    // POST /api/auth/nonce - Request nonce for signing
    if (route === '/auth/nonce' && method === 'POST') {
      const { wallet } = await request.json();
      
      if (!wallet) {
        return handleCORS(NextResponse.json(
          { error: 'Wallet address required' },
          { status: 400 }
        ));
      }

      // Generate nonce
      const nonce = uuidv4();
      const timestamp = new Date().toISOString();
      const domain = request.headers.get('host') || 'solmate.app';
      
      const messageToSign = `SolMate Authentication\n\nDomain: ${domain}\nWallet: ${wallet}\nNonce: ${nonce}\nTimestamp: ${timestamp}\n\nSign this message to verify wallet ownership.`;
      
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
    }

    // POST /api/auth/verify - Verify signature and create session
    if (route === '/auth/verify' && method === 'POST') {
      const { wallet, nonce, signature } = await request.json();
      
      if (!wallet || !nonce || !signature) {
        return handleCORS(NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        ));
      }

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
        
        // Handle both base58 and base64 signatures
        try {
          signatureBytes = bs58.decode(signature);
        } catch {
          signatureBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
        }
        
        const publicKeyBytes = bs58.decode(wallet);
        
        const isValid = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes);
        
        if (!isValid) {
          return handleCORS(NextResponse.json(
            { error: 'Invalid signature' },
            { status: 401 }
          ));
        }
      } catch (e) {
        console.error('Signature verification error:', e);
        return handleCORS(NextResponse.json(
          { error: 'Signature verification failed' },
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
          displayName: null,  // User can set this later
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

      const response = NextResponse.json({
        success: true,
        token,
        user: {
          id: user.id,
          wallet: user.wallet,
          displayName: user.displayName || null,
          friendCode: user.friendCode,
          isVip: user.isVip,
          stats: user.stats,
          chests: user.chests,
          goldPoints: user.goldPoints,
          shards: user.shards,
          equipped: user.equipped,
          inventory: user.inventory
        }
      });

      // Set cookie
      response.cookies.set('solmate_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/'
      });

      return handleCORS(response);
    }

    // GET /api/auth/me - Get current user
    if (route === '/auth/me' && method === 'GET') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!user) {
        return handleCORS(NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        ));
      }

      return handleCORS(NextResponse.json({
        user: {
          id: user.id,
          wallet: user.wallet,
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
    }

    // POST /api/auth/logout - Logout
    if (route === '/auth/logout' && method === 'POST') {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('solmate_session');
      return handleCORS(response);
    }

    // ============================================
    // PAYMENT ENDPOINTS
    // ============================================

    // POST /api/payments/quote - Get SOL quote for USD amount
    if (route === '/payments/quote' && method === 'POST') {
      const { usdAmount } = await request.json();
      const amount = parseFloat(usdAmount) || VIP_PRICE_USDC;
      
      // TODO: In production, fetch real SOL/USD price from an oracle or API
      // For now, use a mock price (this is a stub as requested)
      const mockSolPrice = 150; // $150 per SOL
      const solAmount = amount / mockSolPrice;
      const expiresAt = new Date(Date.now() + 30000); // 30 seconds
      
      const quoteId = uuidv4();
      
      // Store quote
      await db.collection('quotes').insertOne({
        id: quoteId,
        usdAmount: amount,
        solAmount,
        solPrice: mockSolPrice,
        expiresAt,
        used: false,
        createdAt: new Date()
      });

      return handleCORS(NextResponse.json({
        quoteId,
        usdAmount: amount,
        solAmount: solAmount.toFixed(9),
        solPrice: mockSolPrice,
        expiresAt: expiresAt.toISOString(),
        // TODO: SOL pricing is a stub - implement real oracle/API price feed
        isStub: true
      }));
    }

    // POST /api/payments/confirm-vip - Confirm VIP USDC payment with strict on-chain verification
    if (route === '/payments/confirm-vip' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      // Check payment configuration
      if (!PAYMENT_CONFIG_VALID) {
        console.error('[Payment] Rejecting payment - system not configured');
        return handleCORS(NextResponse.json(
          { error: 'Payment system is not configured. Please contact support.' },
          { status: 503 }
        ));
      }

      const { signature } = await request.json();
      
      if (!signature) {
        return handleCORS(NextResponse.json(
          { error: 'Missing transaction signature' },
          { status: 400 }
        ));
      }

      // Validate signature format (base58, 64+ chars)
      if (typeof signature !== 'string' || signature.length < 64) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid transaction signature format' },
          { status: 400 }
        ));
      }

      console.log(`[Payment] Processing VIP payment for ${session.wallet}, sig: ${signature.slice(0,16)}...`);

      // Check if user already has VIP
      const existingUser = await db.collection('users').findOne({ wallet: session.wallet });
      if (existingUser?.isVip) {
        return handleCORS(NextResponse.json(
          { error: 'You already have VIP access' },
          { status: 400 }
        ));
      }

      // Replay protection - check if signature already used (IDEMPOTENCY)
      const existingTx = await db.collection('transactions').findOne({ signature });
      if (existingTx) {
        console.log(`[Payment] Duplicate signature rejected: ${signature.slice(0,16)}...`);
        return handleCORS(NextResponse.json(
          { error: 'Transaction signature already used (duplicate payment attempt)' },
          { status: 400 }
        ));
      }

      // Get the transaction from Solana
      const connection = getSolanaConnection();
      
      try {
        // Wait for transaction to be confirmed with timeout
        let tx = null;
        let retries = 0;
        const maxRetries = 15; // Increased for slower networks
        
        console.log(`[Payment] Fetching transaction from ${CLUSTER}...`);
        
        while (!tx && retries < maxRetries) {
          tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          
          if (!tx) {
            retries++;
            console.log(`[Payment] Transaction not found yet, retry ${retries}/${maxRetries}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          }
        }
        
        if (!tx) {
          return handleCORS(NextResponse.json(
            { error: 'Transaction not found on-chain. Please wait for confirmation and try again.' },
            { status: 400 }
          ));
        }

        if (tx.meta?.err) {
          console.log(`[Payment] Transaction failed on-chain:`, tx.meta.err);
          return handleCORS(NextResponse.json(
            { error: 'Transaction failed on-chain: ' + JSON.stringify(tx.meta.err) },
            { status: 400 }
          ));
        }

        // Verify the transaction is on the expected network by checking slot
        // (A transaction on devnet won't be found on mainnet and vice versa)
        console.log(`[Payment] Transaction found in slot ${tx.slot}, verifying...`);

        // Verify USDC SPL token transfer
        const preTokenBalances = tx.meta?.preTokenBalances || [];
        const postTokenBalances = tx.meta?.postTokenBalances || [];
        
        // Find the developer wallet's USDC ATA balance change
        let verifiedAmount = BigInt(0);
        let senderWallet = null;
        let recipientVerified = false;
        let mintVerified = false;
        
        // Get all account keys from the transaction
        const accountKeys = tx.transaction.message.staticAccountKeys || 
                           tx.transaction.message.accountKeys ||
                           [];
        
        // Find the token balance changes for our USDC mint
        for (const postBalance of postTokenBalances) {
          // Check if this is the correct mint
          if (postBalance.mint !== USDC_MINT) continue;
          mintVerified = true;
          
          // Check if the owner is the developer wallet
          if (postBalance.owner !== DEVELOPER_WALLET) continue;
          recipientVerified = true;
          
          // Find the corresponding pre-balance
          const preBalance = preTokenBalances.find(
            pb => pb.accountIndex === postBalance.accountIndex && pb.mint === USDC_MINT
          );
          
          const preBal = BigInt(preBalance?.uiTokenAmount?.amount || '0');
          const postBal = BigInt(postBalance.uiTokenAmount?.amount || '0');
          
          if (postBal > preBal) {
            verifiedAmount = postBal - preBal;
            console.log(`[Payment] Developer wallet received ${Number(verifiedAmount) / Math.pow(10, USDC_DECIMALS)} USDC`);
          }
        }
        
        // Also identify sender from the balance decreases
        for (const preBalance of preTokenBalances) {
          if (preBalance.mint !== USDC_MINT) continue;
          if (preBalance.owner === DEVELOPER_WALLET) continue; // Skip developer wallet
          
          const postBalance = postTokenBalances.find(
            pb => pb.accountIndex === preBalance.accountIndex && pb.mint === USDC_MINT
          );
          
          const preBal = BigInt(preBalance.uiTokenAmount?.amount || '0');
          const postBal = BigInt(postBalance?.uiTokenAmount?.amount || '0');
          
          if (preBal > postBal) {
            senderWallet = preBalance.owner;
          }
        }

        // Verification checks
        const verificationErrors = [];
        
        if (!mintVerified) {
          verificationErrors.push(`No USDC transfer found. Expected mint: ${USDC_MINT}`);
        }
        
        if (!recipientVerified) {
          verificationErrors.push(`Payment must be sent to: ${DEVELOPER_WALLET}`);
        }
        
        if (verifiedAmount < VIP_PRICE_USDC_RAW) {
          const receivedUsdc = Number(verifiedAmount) / Math.pow(10, USDC_DECIMALS);
          verificationErrors.push(`Insufficient amount. Expected ${VIP_PRICE_USDC} USDC, received ${receivedUsdc.toFixed(2)} USDC`);
        }
        
        // Verify sender is the authenticated user
        if (senderWallet && senderWallet !== session.wallet) {
          verificationErrors.push(`Sender wallet (${senderWallet.slice(0,8)}...) does not match authenticated wallet (${session.wallet.slice(0,8)}...)`);
        }

        if (verificationErrors.length > 0) {
          console.error('[Payment] Verification failed:', verificationErrors);
          return handleCORS(NextResponse.json(
            { 
              error: 'Payment verification failed',
              details: verificationErrors,
              cluster: CLUSTER
            },
            { status: 400 }
          ));
        }

        // All checks passed - record transaction and activate VIP
        const verifiedUsdcAmount = Number(verifiedAmount) / Math.pow(10, USDC_DECIMALS);
        
        // Store transaction record (for idempotency and audit)
        await db.collection('transactions').insertOne({
          id: uuidv4(),
          signature,
          wallet: session.wallet,
          type: 'vip_purchase',
          paymentType: 'USDC',
          mint: USDC_MINT,
          amount: verifiedUsdcAmount,
          amountRaw: verifiedAmount.toString(),
          recipient: DEVELOPER_WALLET,
          verified: true,
          cluster: CLUSTER,
          slot: tx.slot,
          blockTime: tx.blockTime,
          createdAt: new Date()
        });

        // Activate VIP
        await db.collection('users').updateOne(
          { wallet: session.wallet },
          {
            $set: {
              isVip: true,
              vipPurchasedAt: new Date(),
              vipTxSignature: signature
            }
          }
        );

        console.log(`[Payment] ✅ VIP activated for ${session.wallet} - ${verifiedUsdcAmount} USDC on ${CLUSTER}`);

        return handleCORS(NextResponse.json({
          success: true,
          message: 'VIP Lifetime activated!',
          verified: true,
          amount: verifiedUsdcAmount,
          cluster: CLUSTER,
          signature
        }));

      } catch (e) {
        console.error('[Payment] Verification error:', e);
        return handleCORS(NextResponse.json(
          { 
            error: 'Failed to verify transaction',
            details: e.message,
            cluster: CLUSTER
          },
          { status: 500 }
        ));
      }
    }

    // POST /api/payments/confirm - Confirm payment and verify on-chain (legacy)
    if (route === '/payments/confirm' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { signature, paymentType, expectedAmount, quoteId } = await request.json();
      
      if (!signature || !paymentType) {
        return handleCORS(NextResponse.json(
          { error: 'Missing signature or payment type' },
          { status: 400 }
        ));
      }

      // Check if signature already used
      const existingTx = await db.collection('transactions').findOne({ signature });
      if (existingTx) {
        return handleCORS(NextResponse.json(
          { error: 'Transaction already processed' },
          { status: 400 }
        ));
      }

      // Verify on-chain
      const connection = getSolanaConnection();
      
      try {
        const tx = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });
        
        if (!tx) {
          return handleCORS(NextResponse.json(
            { error: 'Transaction not found' },
            { status: 400 }
          ));
        }

        if (tx.meta?.err) {
          return handleCORS(NextResponse.json(
            { error: 'Transaction failed' },
            { status: 400 }
          ));
        }

        let verified = false;
        let verifiedAmount = 0;
        
        if (paymentType === 'SOL') {
          // Verify SOL transfer to developer wallet
          const accountKeys = tx.transaction.message.staticAccountKeys || 
                             tx.transaction.message.accountKeys;
          const devWalletIndex = accountKeys.findIndex(
            key => key.toBase58() === DEVELOPER_WALLET
          );
          
          if (devWalletIndex >= 0 && tx.meta?.postBalances && tx.meta?.preBalances) {
            const preBalance = tx.meta.preBalances[devWalletIndex];
            const postBalance = tx.meta.postBalances[devWalletIndex];
            const received = (postBalance - preBalance) / LAMPORTS_PER_SOL;
            
            // Allow 1% tolerance
            const expected = parseFloat(expectedAmount);
            if (received >= expected * 0.99) {
              verified = true;
              verifiedAmount = received;
            }
          }
        } else if (paymentType === 'USDC') {
          // Verify USDC transfer - check token balances
          // This is simplified - in production, parse token instructions properly
          const expectedUsdc = parseFloat(expectedAmount) || VIP_PRICE_USDC;
          
          // For now, if tx is confirmed and has token transfers, accept it
          // TODO: Implement proper SPL token transfer verification
          if (tx.meta?.postTokenBalances?.length > 0) {
            verified = true;
            verifiedAmount = expectedUsdc;
          }
        }

        if (!verified) {
          return handleCORS(NextResponse.json(
            { error: 'Payment verification failed - incorrect recipient or amount' },
            { status: 400 }
          ));
        }

        // Record transaction
        await db.collection('transactions').insertOne({
          id: uuidv4(),
          signature,
          wallet: session.wallet,
          type: 'vip_purchase',
          paymentType,
          amount: verifiedAmount,
          verified: true,
          createdAt: new Date()
        });

        // Activate VIP
        await db.collection('users').updateOne(
          { wallet: session.wallet },
          {
            $set: {
              isVip: true,
              vipPurchasedAt: new Date()
            }
          }
        );

        return handleCORS(NextResponse.json({
          success: true,
          message: 'VIP activated!',
          verified: true
        }));

      } catch (e) {
        console.error('Payment verification error:', e);
        return handleCORS(NextResponse.json(
          { error: 'Failed to verify transaction' },
          { status: 500 }
        ));
      }
    }

    // ============================================
    // GAME ENDPOINTS
    // ============================================

    // POST /api/game/bot/start - Start bot game
    if (route === '/game/bot/start' && method === 'POST') {
      const { difficulty, isVipArena } = await request.json();
      const session = await requireAuth(request);
      
      const validDifficulties = ['easy', 'normal', 'hard', 'pro'];
      if (!validDifficulties.includes(difficulty)) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid difficulty' },
          { status: 400 }
        ));
      }

      // VIP Arena requires authentication and VIP status
      if (isVipArena) {
        if (!session) {
          return handleCORS(NextResponse.json(
            { error: 'Authentication required for VIP Arena' },
            { status: 401 }
          ));
        }
        
        const user = await db.collection('users').findOne({ wallet: session.wallet });
        if (!user?.isVip) {
          return handleCORS(NextResponse.json(
            { error: 'VIP membership required' },
            { status: 403 }
          ));
        }
      }

      const gameId = uuidv4();
      const playerColor = Math.random() > 0.5 ? 'w' : 'b';
      
      const game = {
        id: gameId,
        type: 'bot',
        difficulty,
        isVipArena: isVipArena || false,
        playerWallet: session?.wallet || null,
        playerColor,
        fen: new Chess().fen(),
        moves: [],
        status: 'active',
        result: null,
        startedAt: new Date(),
        updatedAt: new Date()
      };

      await db.collection('matches').insertOne(game);

      // If bot plays first (player is black), make bot move
      let botMove = null;
      if (playerColor === 'b') {
        botMove = getBotMove(game.fen, difficulty);
        if (botMove) {
          const chess = new Chess(game.fen);
          chess.move(botMove);
          game.fen = chess.fen();
          game.moves.push({ move: botMove, by: 'bot', timestamp: new Date() });
          
          await db.collection('matches').updateOne(
            { id: gameId },
            { $set: { fen: game.fen, moves: game.moves, updatedAt: new Date() } }
          );
        }
      }

      return handleCORS(NextResponse.json({
        gameId,
        playerColor,
        fen: game.fen,
        difficulty,
        isVipArena: game.isVipArena,
        botMove
      }));
    }

    // POST /api/game/bot/move - Make move in bot game
    if (route === '/game/bot/move' && method === 'POST') {
      const { gameId, from, to, promotion } = await request.json();
      
      if (!gameId || !from || !to) {
        return handleCORS(NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        ));
      }

      const game = await db.collection('matches').findOne({ id: gameId });
      
      if (!game) {
        return handleCORS(NextResponse.json(
          { error: 'Game not found' },
          { status: 404 }
        ));
      }

      if (game.status !== 'active') {
        return handleCORS(NextResponse.json(
          { error: 'Game is not active' },
          { status: 400 }
        ));
      }

      // Validate move
      const moveResult = validateMove(game.fen, from, to, promotion);
      
      if (!moveResult.valid) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid move' },
          { status: 400 }
        ));
      }

      // Update game state
      const moves = [...game.moves, {
        move: moveResult.move.san,
        from,
        to,
        by: 'player',
        timestamp: new Date()
      }];
      
      let updatedFen = moveResult.newFen;
      let botMove = null;
      let result = null;
      let status = 'active';

      // Check if game ended after player move
      if (moveResult.isGameOver) {
        status = 'finished';
        if (moveResult.isCheckmate) {
          result = 'player_wins';
        } else {
          result = 'draw';
        }
      } else {
        // Bot's turn
        botMove = getBotMove(updatedFen, game.difficulty);
        
        if (botMove) {
          const chess = new Chess(updatedFen);
          const botMoveResult = chess.move(botMove);
          updatedFen = chess.fen();
          
          moves.push({
            move: botMoveResult.san,
            from: botMoveResult.from,
            to: botMoveResult.to,
            by: 'bot',
            timestamp: new Date()
          });

          // Check if game ended after bot move
          const gameStatus = getGameStatus(updatedFen);
          if (gameStatus.isGameOver) {
            status = 'finished';
            if (gameStatus.isCheckmate) {
              result = 'bot_wins';
            } else {
              result = 'draw';
            }
          }
        }
      }

      // Update database
      await db.collection('matches').updateOne(
        { id: gameId },
        {
          $set: {
            fen: updatedFen,
            moves,
            status,
            result,
            updatedAt: new Date(),
            ...(status === 'finished' ? { finishedAt: new Date() } : {})
          }
        }
      );

      // Handle game end rewards (VIP Arena only)
      let rewards = null;
      if (status === 'finished' && game.isVipArena && game.playerWallet) {
        rewards = await handleGameEndRewards(db, game.playerWallet, result);
      }

      return handleCORS(NextResponse.json({
        success: true,
        fen: updatedFen,
        playerMove: moveResult.move,
        botMove: botMove ? {
          san: moves[moves.length - 1].move,
          from: moves[moves.length - 1].from,
          to: moves[moves.length - 1].to
        } : null,
        isGameOver: status === 'finished',
        result,
        rewards
      }));
    }

    // POST /api/game/bot/resign - Resign bot game
    if (route === '/game/bot/resign' && method === 'POST') {
      const { gameId } = await request.json();
      
      const game = await db.collection('matches').findOne({ id: gameId });
      
      if (!game || game.status !== 'active') {
        return handleCORS(NextResponse.json(
          { error: 'Game not found or not active' },
          { status: 400 }
        ));
      }

      await db.collection('matches').updateOne(
        { id: gameId },
        {
          $set: {
            status: 'finished',
            result: 'bot_wins',
            finishedAt: new Date()
          }
        }
      );

      // Handle loss rewards (VIP Arena only - will reset streak)
      let rewards = null;
      if (game.isVipArena && game.playerWallet) {
        rewards = await handleGameEndRewards(db, game.playerWallet, 'bot_wins');
      }

      return handleCORS(NextResponse.json({
        success: true,
        result: 'bot_wins',
        rewards
      }));
    }

    // ============================================
    // INVENTORY ENDPOINTS
    // ============================================

    // GET /api/inventory - Get user inventory
    if (route === '/inventory' && method === 'GET') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!user) {
        return handleCORS(NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        ));
      }

      const allCosmetics = getAllCosmetics();

      return handleCORS(NextResponse.json({
        inventory: user.inventory,
        equipped: user.equipped,
        chests: user.chests,
        goldPoints: user.goldPoints,
        shards: user.shards,
        allCosmetics
      }));
    }

    // POST /api/inventory/open-chest - Open chest(s)
    if (route === '/inventory/open-chest' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { chestType, count = 1 } = await request.json();
      
      if (!['bronze', 'silver', 'gold'].includes(chestType)) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid chest type' },
          { status: 400 }
        ));
      }

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!user || user.chests[chestType] < count) {
        return handleCORS(NextResponse.json(
          { error: 'Not enough chests' },
          { status: 400 }
        ));
      }

      const allRewards = [];
      let totalShards = 0;
      const newItems = [];

      for (let i = 0; i < count; i++) {
        const { rewards, shards } = openChest(chestType, user.inventory);
        allRewards.push(...rewards);
        totalShards += shards;
        
        for (const reward of rewards) {
          if (!reward.isDuplicate) {
            const itemKey = `${reward.type}_${reward.id}`;
            if (!user.inventory.includes(itemKey) && !newItems.includes(itemKey)) {
              newItems.push(itemKey);
            }
          }
        }
      }

      // Update user
      await db.collection('users').updateOne(
        { wallet: session.wallet },
        {
          $inc: {
            [`chests.${chestType}`]: -count,
            shards: totalShards
          },
          $addToSet: {
            inventory: { $each: newItems }
          }
        }
      );

      return handleCORS(NextResponse.json({
        success: true,
        rewards: allRewards,
        shardsEarned: totalShards,
        newItems
      }));
    }

    // POST /api/inventory/redeem-gold - Redeem gold points for gold chest
    if (route === '/inventory/redeem-gold' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { count = 1 } = await request.json();
      const requiredPoints = count * 5;

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!user || user.goldPoints < requiredPoints) {
        return handleCORS(NextResponse.json(
          { error: 'Not enough gold points (need 5 per chest)' },
          { status: 400 }
        ));
      }

      await db.collection('users').updateOne(
        { wallet: session.wallet },
        {
          $inc: {
            goldPoints: -requiredPoints,
            'chests.gold': count
          }
        }
      );

      return handleCORS(NextResponse.json({
        success: true,
        goldChestsReceived: count,
        pointsSpent: requiredPoints
      }));
    }

    // POST /api/inventory/equip - Equip cosmetic
    if (route === '/inventory/equip' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { type, itemId } = await request.json();
      
      if (!['piece', 'board', 'avatar'].includes(type)) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid item type' },
          { status: 400 }
        ));
      }

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      const itemKey = `${type}_${itemId}`;
      
      if (!user?.inventory.includes(itemKey)) {
        return handleCORS(NextResponse.json(
          { error: 'Item not owned' },
          { status: 400 }
        ));
      }

      await db.collection('users').updateOne(
        { wallet: session.wallet },
        { $set: { [`equipped.${type}`]: itemId } }
      );

      return handleCORS(NextResponse.json({
        success: true,
        equipped: { [type]: itemId }
      }));
    }

    // ============================================
    // USER PROFILE ENDPOINTS
    // ============================================

    // GET /api/user/profile - Get current user profile
    if (route === '/user/profile' && method === 'GET') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const user = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!user) {
        return handleCORS(NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        ));
      }

      return handleCORS(NextResponse.json({
        profile: {
          wallet: user.wallet,
          displayName: user.displayName || null,
          avatarId: user.equipped?.avatar || 'default',
          friendCode: user.friendCode,
          isVip: user.isVip,
          stats: user.stats,
          inventory: user.inventory,
          equipped: user.equipped,
          createdAt: user.createdAt
        }
      }));
    }

    // POST /api/user/profile - Update user profile (displayName + avatarId)
    if (route === '/user/profile' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { displayName, avatarId } = await request.json();
      const updates = {};
      const errors = [];

      // Validate displayName if provided
      if (displayName !== undefined) {
        if (displayName === null || displayName === '') {
          // Allow clearing display name
          updates.displayName = null;
        } else {
          const trimmedName = String(displayName).trim();
          
          // Length validation (3-16 characters)
          if (trimmedName.length < 3 || trimmedName.length > 16) {
            errors.push('Display name must be 3-16 characters');
          }
          
          // Character validation (letters, numbers, underscore only)
          if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
            errors.push('Display name can only contain letters, numbers, and underscores');
          }
          
          if (errors.length === 0) {
            // Check uniqueness (case-insensitive)
            const existingUser = await db.collection('users').findOne({
              displayName: { $regex: new RegExp(`^${trimmedName}$`, 'i') },
              wallet: { $ne: session.wallet }
            });
            
            if (existingUser) {
              errors.push('This display name is already taken');
            } else {
              updates.displayName = trimmedName;
            }
          }
        }
      }

      // Validate avatarId if provided
      if (avatarId !== undefined) {
        const validAvatars = ['default', 'pawn', 'knight', 'bishop', 'rook', 'queen', 'king', 'grandmaster'];
        
        if (!validAvatars.includes(avatarId)) {
          errors.push('Invalid avatar selection');
        } else {
          // Check if user owns this avatar (default is always owned)
          const user = await db.collection('users').findOne({ wallet: session.wallet });
          const avatarKey = `avatar_${avatarId}`;
          
          if (avatarId !== 'default' && !user.inventory?.includes(avatarKey)) {
            errors.push('You do not own this avatar');
          } else {
            updates['equipped.avatar'] = avatarId;
          }
        }
      }

      if (errors.length > 0) {
        return handleCORS(NextResponse.json(
          { error: errors.join('. ') },
          { status: 400 }
        ));
      }

      if (Object.keys(updates).length === 0) {
        return handleCORS(NextResponse.json(
          { error: 'No valid fields to update' },
          { status: 400 }
        ));
      }

      await db.collection('users').updateOne(
        { wallet: session.wallet },
        { $set: updates }
      );

      // Get updated user
      const updatedUser = await db.collection('users').findOne({ wallet: session.wallet });

      return handleCORS(NextResponse.json({
        success: true,
        profile: {
          displayName: updatedUser.displayName || null,
          avatarId: updatedUser.equipped?.avatar || 'default'
        }
      }));
    }

    // ============================================
    // USER PREFERENCES ENDPOINTS
    // ============================================

    // POST /api/user/language - Update user language preference
    if (route === '/user/language' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { language } = await request.json();
      const supportedLanguages = ['en', 'de', 'ar', 'zh'];
      
      if (!language || !supportedLanguages.includes(language)) {
        return handleCORS(NextResponse.json(
          { error: 'Invalid language. Supported: en, de, ar, zh' },
          { status: 400 }
        ));
      }

      await db.collection('users').updateOne(
        { wallet: session.wallet },
        { $set: { language: language } }
      );

      return handleCORS(NextResponse.json({
        success: true,
        language
      }));
    }

    // ============================================
    // FRIENDS ENDPOINTS
    // ============================================

    // GET /api/friends - Get friends list
    if (route === '/friends' && method === 'GET') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const friendships = await db.collection('friends')
        .find({ wallet: session.wallet, status: 'accepted' })
        .toArray();

      const friendWallets = friendships.map(f => f.friendWallet);
      const friends = await db.collection('users')
        .find({ wallet: { $in: friendWallets } })
        .project({ wallet: 1, displayName: 1, friendCode: 1, isVip: 1, equipped: 1, lastLoginAt: 1 })
        .toArray();

      // Add friendship metadata
      const friendsWithMeta = friends.map(f => {
        const friendship = friendships.find(fs => fs.friendWallet === f.wallet);
        return {
          ...f,
          avatarId: f.equipped?.avatar || 'default',
          friendsSince: friendship?.acceptedAt,
          canGift: friendship?.acceptedAt && 
            (new Date() - new Date(friendship.acceptedAt)) > 24 * 60 * 60 * 1000
        };
      });

      return handleCORS(NextResponse.json({ friends: friendsWithMeta }));
    }

    // POST /api/friends/add - Add friend by code or wallet
    if (route === '/friends/add' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { friendCode, wallet: friendWallet } = await request.json();
      
      let targetUser;
      if (friendCode) {
        targetUser = await db.collection('users').findOne({ friendCode: friendCode.toUpperCase() });
      } else if (friendWallet) {
        targetUser = await db.collection('users').findOne({ wallet: friendWallet });
      }

      if (!targetUser) {
        return handleCORS(NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        ));
      }

      if (targetUser.wallet === session.wallet) {
        return handleCORS(NextResponse.json(
          { error: 'Cannot add yourself' },
          { status: 400 }
        ));
      }

      // Check existing friendship
      const existing = await db.collection('friends').findOne({
        wallet: session.wallet,
        friendWallet: targetUser.wallet
      });

      if (existing) {
        return handleCORS(NextResponse.json(
          { error: 'Already friends or request pending' },
          { status: 400 }
        ));
      }

      const now = new Date();
      
      // Create bidirectional friendship (auto-accept for simplicity)
      await db.collection('friends').insertMany([
        {
          id: uuidv4(),
          wallet: session.wallet,
          friendWallet: targetUser.wallet,
          status: 'accepted',
          createdAt: now,
          acceptedAt: now
        },
        {
          id: uuidv4(),
          wallet: targetUser.wallet,
          friendWallet: session.wallet,
          status: 'accepted',
          createdAt: now,
          acceptedAt: now
        }
      ]);

      return handleCORS(NextResponse.json({
        success: true,
        message: 'Friend added!',
        friend: {
          wallet: targetUser.wallet,
          friendCode: targetUser.friendCode
        }
      }));
    }

    // ============================================
    // GIFTING ENDPOINTS
    // ============================================

    // GET /api/gifts/status - Get today's gift status
    if (route === '/gifts/status' && method === 'GET') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const giftsToday = await db.collection('gifts').countDocuments({
        fromWallet: session.wallet,
        createdAt: { $gte: today }
      });

      const nextGiftFee = giftsToday === 0 ? 0 : giftsToday * 0.01;

      return handleCORS(NextResponse.json({
        giftsSentToday: giftsToday,
        maxGiftsPerDay: 10,
        nextGiftFee,
        isFreeGiftAvailable: giftsToday === 0
      }));
    }

    // POST /api/gifts/send - Send gift to friend
    if (route === '/gifts/send' && method === 'POST') {
      const session = await requireAuth(request);
      
      if (!session) {
        return handleCORS(NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        ));
      }

      const { toWallet, itemType, itemId, txSignature } = await request.json();
      
      // Check friendship (24h requirement)
      const friendship = await db.collection('friends').findOne({
        wallet: session.wallet,
        friendWallet: toWallet,
        status: 'accepted'
      });

      if (!friendship) {
        return handleCORS(NextResponse.json(
          { error: 'Not friends with this user' },
          { status: 400 }
        ));
      }

      const hoursSinceFriends = (new Date() - new Date(friendship.acceptedAt)) / (1000 * 60 * 60);
      if (hoursSinceFriends < 24) {
        return handleCORS(NextResponse.json(
          { error: 'Must be friends for at least 24 hours to gift' },
          { status: 400 }
        ));
      }

      // Check gift count today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const giftsToday = await db.collection('gifts').countDocuments({
        fromWallet: session.wallet,
        createdAt: { $gte: today }
      });

      if (giftsToday >= 10) {
        return handleCORS(NextResponse.json(
          { error: 'Max 10 gifts per day' },
          { status: 400 }
        ));
      }

      // Check if fee is required (gift #2+)
      const requiredFee = giftsToday === 0 ? 0 : giftsToday * 0.01;
      
      if (requiredFee > 0 && !txSignature) {
        return handleCORS(NextResponse.json(
          { error: `Gift #${giftsToday + 1} requires ${requiredFee} SOL fee`, requiredFee },
          { status: 400 }
        ));
      }

      // Verify fee payment if required
      if (requiredFee > 0 && txSignature) {
        // Check signature not used
        const existingTx = await db.collection('transactions').findOne({ signature: txSignature });
        if (existingTx) {
          return handleCORS(NextResponse.json(
            { error: 'Transaction already used' },
            { status: 400 }
          ));
        }

        // Verify on-chain (simplified - in production do proper verification)
        const connection = getSolanaConnection();
        const tx = await connection.getTransaction(txSignature, { commitment: 'confirmed' });
        
        if (!tx || tx.meta?.err) {
          return handleCORS(NextResponse.json(
            { error: 'Invalid fee transaction' },
            { status: 400 }
          ));
        }

        // Record fee transaction
        await db.collection('transactions').insertOne({
          id: uuidv4(),
          signature: txSignature,
          wallet: session.wallet,
          type: 'gift_fee',
          amount: requiredFee,
          createdAt: new Date()
        });
      }

      // Check sender owns item
      const itemKey = `${itemType}_${itemId}`;
      const sender = await db.collection('users').findOne({ wallet: session.wallet });
      
      if (!sender?.inventory.includes(itemKey)) {
        return handleCORS(NextResponse.json(
          { error: 'You do not own this item' },
          { status: 400 }
        ));
      }

      // Transfer item
      await db.collection('users').updateOne(
        { wallet: session.wallet },
        { $pull: { inventory: itemKey } }
      );

      await db.collection('users').updateOne(
        { wallet: toWallet },
        { $addToSet: { inventory: itemKey } }
      );

      // Record gift
      await db.collection('gifts').insertOne({
        id: uuidv4(),
        fromWallet: session.wallet,
        toWallet,
        itemType,
        itemId,
        fee: requiredFee,
        txSignature: txSignature || null,
        createdAt: new Date()
      });

      return handleCORS(NextResponse.json({
        success: true,
        message: 'Gift sent!',
        giftNumber: giftsToday + 1
      }));
    }

    // ============================================
    // LEADERBOARD ENDPOINTS
    // ============================================

    // GET /api/leaderboard - Get leaderboard
    if (route === '/leaderboard' && method === 'GET') {
      const url = new URL(request.url);
      const period = url.searchParams.get('period') || 'all';
      
      let dateFilter = {};
      const now = new Date();
      
      if (period === 'daily') {
        const dayStart = new Date(now);
        dayStart.setHours(0, 0, 0, 0);
        dateFilter = { lastLoginAt: { $gte: dayStart } };
      } else if (period === 'weekly') {
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - 7);
        dateFilter = { lastLoginAt: { $gte: weekStart } };
      }

      const leaders = await db.collection('users')
        .find({ isVip: true, ...dateFilter })
        .sort({ 'stats.vipWins': -1, 'stats.vipBestStreak': -1 })
        .limit(100)
        .project({
          wallet: 1,
          displayName: 1,
          friendCode: 1,
          'stats.vipWins': 1,
          'stats.vipLosses': 1,
          'stats.vipBestStreak': 1,
          equipped: 1
        })
        .toArray();

      return handleCORS(NextResponse.json({
        period,
        leaderboard: leaders.map((l, i) => ({
          rank: i + 1,
          wallet: l.wallet,
          displayName: l.displayName || null,
          friendCode: l.friendCode,
          wins: l.stats?.vipWins || 0,
          losses: l.stats?.vipLosses || 0,
          bestStreak: l.stats?.vipBestStreak || 0,
          avatarId: l.equipped?.avatar || 'default'
        }))
      }));
    }

    // ============================================
    // COSMETICS CATALOG
    // ============================================

    // GET /api/cosmetics - Get all cosmetics
    if (route === '/cosmetics' && method === 'GET') {
      return handleCORS(NextResponse.json({
        cosmetics: getAllCosmetics(),
        chestRates: CHEST_DROP_RATES
      }));
    }

    // Route not found
    return handleCORS(NextResponse.json(
      { error: `Route ${route} not found` },
      { status: 404 }
    ));

  } catch (error) {
    console.error('API Error:', error);
    return handleCORS(NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    ));
  }
}

// Helper: Handle game end rewards
async function handleGameEndRewards(db, wallet, result) {
  const user = await db.collection('users').findOne({ wallet });
  if (!user) return null;

  const rewards = {
    bronzeChest: 0,
    silverChest: 0,
    goldPoints: 0,
    streakReset: false,
    newStreak: user.stats.vipCurrentStreak
  };

  if (result === 'player_wins') {
    // Award bronze chest
    rewards.bronzeChest = 1;
    
    // Update streak
    const newStreak = user.stats.vipCurrentStreak + 1;
    rewards.newStreak = newStreak;
    
    // Check for 5-win streak bonus
    if (newStreak >= 5 && newStreak % 5 === 0) {
      rewards.silverChest = 1;
      rewards.goldPoints = 1;
    }

    await db.collection('users').updateOne(
      { wallet },
      {
        $inc: {
          'stats.vipWins': 1,
          'stats.wins': 1,
          'chests.bronze': rewards.bronzeChest,
          'chests.silver': rewards.silverChest,
          goldPoints: rewards.goldPoints
        },
        $set: {
          'stats.vipCurrentStreak': newStreak,
          'stats.vipBestStreak': Math.max(newStreak, user.stats.vipBestStreak || 0)
        }
      }
    );

  } else if (result === 'bot_wins') {
    // Reset streak on loss
    rewards.streakReset = true;
    rewards.newStreak = 0;

    await db.collection('users').updateOne(
      { wallet },
      {
        $inc: {
          'stats.vipLosses': 1,
          'stats.losses': 1
        },
        $set: {
          'stats.vipCurrentStreak': 0
        }
      }
    );

  } else if (result === 'draw') {
    // Draw: no chest, streak unchanged
    await db.collection('users').updateOne(
      { wallet },
      {
        $inc: {
          'stats.draws': 1
        }
      }
    );
  }

  return rewards;
}

// Export HTTP methods
export const GET = handleRoute;
export const POST = handleRoute;
export const PUT = handleRoute;
export const DELETE = handleRoute;
export const PATCH = handleRoute;
