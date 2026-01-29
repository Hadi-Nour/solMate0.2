import { MongoClient } from 'mongodb';

const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'solmate';

let client = null;
let db = null;

export async function connectToMongo() {
  if (db) return db;
  
  if (!client) {
    client = new MongoClient(MONGO_URL);
    await client.connect();
  }
  
  db = client.db(DB_NAME);
  return db;
}

export async function getCollection(name) {
  const database = await connectToMongo();
  return database.collection(name);
}

// Initialize indexes
export async function initializeIndexes() {
  const database = await connectToMongo();
  
  // Users collection
  await database.collection('users').createIndex({ wallet: 1 }, { name: 'wallet_1_partial_string', unique: true, partialFilterExpression: { wallet: { $type: 'string' } } });
  await database.collection('users').createIndex({ friendCode: 1 }, { unique: true, sparse: true });
  
  // Nonces collection
  await database.collection('nonces').createIndex({ nonce: 1 }, { unique: true });
  await database.collection('nonces').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  
  // Transactions collection
  await database.collection('transactions').createIndex({ signature: 1 }, { unique: true });
  await database.collection('transactions').createIndex({ wallet: 1 });
  
  // Matches collection
  await database.collection('matches').createIndex({ id: 1 }, { unique: true });
  await database.collection('matches').createIndex({ 'players.white': 1 });
  await database.collection('matches').createIndex({ 'players.black': 1 });
  await database.collection('matches').createIndex({ status: 1 });
  
  // Friends collection
  await database.collection('friends').createIndex({ wallet: 1 });
  await database.collection('friends').createIndex({ friendWallet: 1 });
  
  // Gifts collection
  await database.collection('gifts').createIndex({ fromWallet: 1 });
  await database.collection('gifts').createIndex({ toWallet: 1 });
  await database.collection('gifts').createIndex({ date: 1 });
  
  console.log('MongoDB indexes initialized');
}
