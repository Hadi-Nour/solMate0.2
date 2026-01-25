import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import EmailProvider from 'next-auth/providers/email';
import GoogleProvider from 'next-auth/providers/google';
import FacebookProvider from 'next-auth/providers/facebook';
import TwitterProvider from 'next-auth/providers/twitter';
import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

// Create Nodemailer transporter for Zoho SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.zoho.eu',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Custom email sending function for Magic Link
async function sendVerificationEmail({ identifier, url, provider }) {
  const transporter = createTransporter();
  
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Sign in to SolMate</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0f0f23; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <tr>
          <td align="center">
            <!-- Logo/Header -->
            <div style="margin-bottom: 32px;">
              <h1 style="color: #ffffff; font-size: 32px; margin: 0; display: flex; align-items: center; justify-content: center;">
                ♟️ <span style="background: linear-gradient(135deg, #9333ea, #3b82f6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-left: 8px;">SolMate</span>
              </h1>
              <p style="color: #a1a1aa; font-size: 14px; margin-top: 8px;">Chess on Solana</p>
            </div>
            
            <!-- Main Card -->
            <div style="background: linear-gradient(145deg, #1a1a2e, #16162a); border-radius: 16px; padding: 40px; border: 1px solid #2d2d44;">
              <h2 style="color: #ffffff; font-size: 24px; margin: 0 0 16px 0; text-align: center;">
                🔐 Sign in to SolMate
              </h2>
              
              <p style="color: #d1d5db; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
                Click the button below to securely sign in to your account. This link expires in 24 hours.
              </p>
              
              <!-- Magic Link Button -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${url}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #9333ea, #6366f1); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);">
                  ✨ Sign in to SolMate
                </a>
              </div>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                If you didn't request this email, you can safely ignore it.
              </p>
            </div>
            
            <!-- Footer -->
            <div style="margin-top: 32px; text-align: center;">
              <p style="color: #6b7280; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} SolMate. All rights reserved.
              </p>
              <p style="color: #4b5563; font-size: 11px; margin-top: 8px;">
                This is an automated email from SolMate. Please do not reply.
              </p>
            </div>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const result = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'SolMate <noreply@playsolmates.app>',
    to: identifier,
    subject: '🔐 Sign in to SolMate',
    html: emailHtml,
    text: `Sign in to SolMate\n\nClick this link to sign in: ${url}\n\nThis link expires in 24 hours.\n\nIf you didn't request this email, you can safely ignore it.`,
  });

  console.log('[Email] Verification email sent:', result.messageId);
  return result;
}

// MongoDB connection
let client;
let db;

async function connectToMongo() {
  if (db) return db;
  
  const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017';
  client = new MongoClient(mongoUrl);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'solmate');
  
  // Create indexes
  await db.collection('users').createIndex({ email: 1 }, { unique: true, sparse: true });
  await db.collection('users').createIndex({ odudx: 1 }, { unique: true });
  
  return db;
}

export const authOptions = {
  providers: [
    // Email Magic Link Provider (Zoho SMTP)
    EmailProvider({
      server: {
        host: process.env.SMTP_HOST || 'smtp.zoho.eu',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      },
      from: process.env.EMAIL_FROM || 'SolMate <noreply@playsolmates.app>',
      sendVerificationRequest: async ({ identifier, url, provider }) => {
        await sendVerificationEmail({ identifier, url, provider });
      },
      maxAge: 24 * 60 * 60, // 24 hours
    }),

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

    // Google OAuth
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),

    // Facebook OAuth
    FacebookProvider({
      clientId: process.env.FACEBOOK_CLIENT_ID || '',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),

    // Twitter/X OAuth
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID || '',
      clientSecret: process.env.TWITTER_CLIENT_SECRET || '',
      version: '2.0',
    }),
  ],

  pages: {
    signIn: '/auth/login',
    signUp: '/auth/signup',
    error: '/auth/error',
    verifyRequest: '/auth/verify-email',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      const db = await connectToMongo();

      // For OAuth providers, create or update user
      if (account?.provider !== 'credentials') {
        const email = user.email?.toLowerCase();
        
        const existingUser = await db.collection('users').findOne({
          $or: [
            { email: email },
            { [`oauth.${account.provider}`]: account.providerAccountId }
          ]
        });

        if (existingUser) {
          // Update OAuth link
          await db.collection('users').updateOne(
            { userId: existingUser.userId },
            {
              $set: {
                [`oauth.${account.provider}`]: account.providerAccountId,
                lastLogin: new Date(),
                ...(user.image && !existingUser.avatarUrl ? { avatarUrl: user.image } : {}),
              }
            }
          );
        } else {
          // Create new user
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
            emailVerified: true, // OAuth emails are pre-verified
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLogin: new Date(),
            // Game data
            friends: [],
            stats: { wins: 0, losses: 0, draws: 0 },
            wallet: null, // Solana wallet can be linked later
            isVip: false,
          });
        }
      }

      return true;
    },

    async jwt({ token, user, account }) {
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

  events: {
    async signIn({ user, account }) {
      console.log(`[Auth] User signed in: ${user.email} via ${account?.provider}`);
    },
  },

  debug: process.env.NODE_ENV === 'development',
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
