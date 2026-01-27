import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import TwitterProvider from 'next-auth/providers/twitter';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

// MongoDB connection
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

export const authOptions = {
  providers: [
    // Email/Password Provider
    CredentialsProvider({
      id: 'credentials',
      name: 'Email',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Please enter email and password');
        }

        const db = await connectToMongo();
        const user = await db.collection('users').findOne({ 
          email: credentials.email.toLowerCase() 
        });

        if (!user) {
          throw new Error('No account found with this email');
        }

        if (!user.password) {
          throw new Error('Please login with the method you used to create your account');
        }

        if (!user.emailVerified) {
          throw new Error('Please verify your email before logging in');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        
        if (!isValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user.userId,
          email: user.email,
          name: user.displayName || user.email.split('@')[0],
          image: user.avatarUrl,
        };
      }
    }),

    // Google OAuth (conditional)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    ] : []),

    // Facebook OAuth (conditional)
    ...(process.env.FACEBOOK_CLIENT_ID && process.env.FACEBOOK_CLIENT_SECRET ? [
      FacebookProvider({
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    ] : []),

    // Twitter OAuth (conditional)
    ...(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET ? [
      TwitterProvider({
        clientId: process.env.TWITTER_CLIENT_ID,
        clientSecret: process.env.TWITTER_CLIENT_SECRET,
        version: '2.0',
      }),
    ] : []),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: '/auth/login',
    signUp: '/auth/signup',
    error: '/auth/login',
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      const db = await connectToMongo();
      const email = user.email?.toLowerCase();
      
      if (!email) {
        return false;
      }

      // Check if user exists
      const existingUser = await db.collection('users').findOne({ email });

      if (!existingUser && account?.provider !== 'credentials') {
        // Create new user for OAuth
        const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await db.collection('users').insertOne({
          userId,
          email: email,
          displayName: user.name || email?.split('@')[0],
          avatarUrl: user.image,
          authProvider: account.provider,
          oauth: {
            [account.provider]: account.providerAccountId,
          },
          emailVerified: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLogin: new Date(),
          friends: [],
          stats: { wins: 0, losses: 0, draws: 0 },
          wallet: null,
          isVip: false,
        });
      } else if (existingUser) {
        // Update last login
        await db.collection('users').updateOne(
          { email },
          { $set: { lastLogin: new Date() } }
        );
      }

      return true;
    },

    async jwt({ token, user }) {
      if (user) {
        const db = await connectToMongo();
        const dbUser = await db.collection('users').findOne({
          $or: [
            { email: user.email?.toLowerCase() },
            { userId: user.id }
          ]
        });

        if (dbUser) {
          token.userId = dbUser.userId;
          token.displayName = dbUser.displayName;
          token.wallet = dbUser.wallet;
          token.isVip = dbUser.isVip;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.userId = token.userId;
        session.user.displayName = token.displayName;
        session.user.wallet = token.wallet;
        session.user.isVip = token.isVip;
      }
      return session;
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
