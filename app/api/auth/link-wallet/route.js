import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';
import { MongoClient } from 'mongodb';

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

// Link Solana wallet to account
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: 'You must be logged in to link a wallet' },
        { status: 401 }
      );
    }

    const { wallet, signature, message } = await request.json();

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // TODO: Verify signature if provided (optional extra security)
    // For now, we trust the client-side wallet connection

    const db = await connectToMongo();

    // Check if wallet is already linked to another account
    const existingWallet = await db.collection('users').findOne({
      wallet: wallet,
      userId: { $ne: session.user.userId }
    });

    if (existingWallet) {
      return NextResponse.json(
        { error: 'This wallet is already linked to another account' },
        { status: 400 }
      );
    }

    // Link wallet to user
    await db.collection('users').updateOne(
      { userId: session.user.userId },
      {
        $set: {
          wallet: wallet,
          walletLinkedAt: new Date(),
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Wallet linked successfully',
      wallet: wallet
    });

  } catch (error) {
    console.error('[Link Wallet] Error:', error);
    return NextResponse.json(
      { error: 'Failed to link wallet' },
      { status: 500 }
    );
  }
}

// Unlink Solana wallet from account
export async function DELETE(request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.userId) {
      return NextResponse.json(
        { error: 'You must be logged in' },
        { status: 401 }
      );
    }

    const db = await connectToMongo();

    await db.collection('users').updateOne(
      { userId: session.user.userId },
      {
        $set: {
          wallet: null,
          walletLinkedAt: null,
          updatedAt: new Date()
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Wallet unlinked successfully'
    });

  } catch (error) {
    console.error('[Unlink Wallet] Error:', error);
    return NextResponse.json(
      { error: 'Failed to unlink wallet' },
      { status: 500 }
    );
  }
}
