import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import { MongoClient } from 'mongodb';
import { jwtVerify } from 'jose';

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

function handleCORS(res) {
  res.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  return res;
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }));
}

function getTokenFromRequest() {
  // 1) Authorization: Bearer <token>
  const auth = headers().get('authorization') || headers().get('Authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }

  // 2) Cookies (support multiple names)
  const c = cookies();
  return (
    c.get('solmate_session')?.value ||
    c.get('solmate_token')?.value ||
    c.get('next-auth.session-token')?.value ||
    c.get('__Secure-next-auth.session-token')?.value ||
    null
  );
}

export async function GET() {
  try {
    const token = getTokenFromRequest();
    if (!token) {
      return handleCORS(NextResponse.json({ error: 'Not authenticated' }, { status: 401 }));
    }

    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'change-me'
    );

    let payload;
    try {
      ({ payload } = await jwtVerify(token, secret));
    } catch {
      return handleCORS(NextResponse.json({ error: 'Not authenticated' }, { status: 401 }));
    }

    const db = await connectToMongo();

    const wallet = payload?.wallet;
    const email = payload?.email;

    let user = null;
    if (wallet) user = await db.collection('users').findOne({ wallet: String(wallet) });
    else if (email) user = await db.collection('users').findOne({ email: String(email).toLowerCase() });

    if (!user) {
      return handleCORS(NextResponse.json({ error: 'User not found' }, { status: 401 }));
    }

    const safeUser = {
      id: user.id,
      email: user.email || null,
      wallet: user.wallet || null,
      displayName: user.displayName || null,
      friendCode: user.friendCode || null,
      isVip: !!user.isVip,
      stats: user.stats || null,
      chests: user.chests || null,
      goldPoints: user.goldPoints ?? 0,
      shards: user.shards ?? 0,
      inventory: user.inventory || [],
      equipped: user.equipped || null,
      authProvider: user.authProvider || (user.wallet ? 'wallet' : 'email')
    };

    console.log('[Auth/Me] User found:', safeUser.id, 'email:', safeUser.email || 'none');
    return handleCORS(NextResponse.json({ success: true, user: safeUser }, { status: 200 }));
  } catch (error) {
    console.error('[Auth/Me] Error:', error);
    return handleCORS(NextResponse.json({ error: 'Server error' }, { status: 500 }));
  }
}
