# SolMate - Deployment Guide

## Overview
SolMate is a Solana-powered chess PWA with VIP memberships, cosmetic rewards, real-time multiplayer, and full authentication (Email + OAuth).

## System Requirements

- **Node.js**: v18.x or v20.x (LTS recommended)
- **MongoDB**: v5.x or v6.x (or MongoDB Atlas)
- **RAM**: Minimum 1GB, recommended 2GB+
- **Storage**: 500MB for application + database storage

## Quick Start

### 1. Clone and Install

```bash
# Clone the repository
git clone <your-repo-url> solmate
cd solmate

# Install dependencies
yarn install
# or
npm install
```

### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

### 3. Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_APP_URL` | Your public domain URL | `https://playsolmates.app` |
| `NEXT_PUBLIC_BASE_URL` | Same as APP_URL | `https://playsolmates.app` |
| `MONGO_URL` | MongoDB connection string | `mongodb://localhost:27017/solmate` |
| `JWT_SECRET` | Secret for wallet JWT tokens (64+ chars) | Random string |
| `NEXTAUTH_SECRET` | Secret for NextAuth sessions | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your production URL | `https://playsolmates.app` |
| `NEXT_PUBLIC_SOLANA_CLUSTER` | Solana network | `devnet` or `mainnet-beta` |
| `NEXT_PUBLIC_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `DEVELOPER_WALLET` | Your wallet for payments | Solana address |

### 4. OAuth Provider Setup (Optional but Recommended)

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 credentials
3. Set Authorized redirect URI: `https://playsolmates.app/api/auth/callback/google`
4. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   ```

#### Facebook/Meta OAuth
1. Go to [Meta Developers](https://developers.facebook.com/apps/)
2. Create an app → Consumer type
3. Add Facebook Login product
4. Set Valid OAuth Redirect URI: `https://playsolmates.app/api/auth/callback/facebook`
5. Set Privacy Policy URL: `https://playsolmates.app/privacy-policy`
6. Set Data Deletion Callback: `https://playsolmates.app/api/auth/data-deletion`
7. Add to `.env`:
   ```
   FACEBOOK_CLIENT_ID=your-app-id
   FACEBOOK_CLIENT_SECRET=your-app-secret
   ```

#### Twitter/X OAuth
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/projects-and-apps)
2. Create app with OAuth 2.0
3. Set Callback URL: `https://playsolmates.app/api/auth/callback/twitter`
4. Add to `.env`:
   ```
   TWITTER_CLIENT_ID=your-client-id
   TWITTER_CLIENT_SECRET=your-client-secret
   ```

### 5. Email/SMTP Setup (Required for Email Registration)

Using Zoho Mail (recommended):
1. Create email accounts at your domain (e.g., noreply@playsolmates.app)
2. Generate App Password at [Zoho Security](https://accounts.zoho.com/home#security/security_app-password)
3. Add to `.env`:
   ```
   SMTP_HOST=smtp.zoho.com
   SMTP_PORT=465
   SMTP_USER=noreply@playsolmates.app
   SMTP_PASS=your-app-password
   ```

### 6. Build for Production

```bash
# Build the Next.js application
yarn build
# or
npm run build
```

### 7. Start the Server with PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start using ecosystem file (recommended)
pm2 start ecosystem.config.js --env production

# Or start directly
pm2 start server.mjs --name solmate

# Save process list (persists across reboots)
pm2 save

# Setup auto-start on system boot
pm2 startup
```

The server runs on port `3000` by default (configurable via `PORT` env var).

## Nginx Reverse Proxy Configuration

Create `/etc/nginx/sites-available/solmate`:

```nginx
server {
    listen 80;
    server_name playsolmates.app www.playsolmates.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name playsolmates.app www.playsolmates.app;

    # SSL certificates (use Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/playsolmates.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playsolmates.app/privkey.pem;

    # SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.io specific path (optional, can use same location)
    location /api/socket {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Static files caching
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 365d;
        add_header Cache-Control "public, immutable";
    }

    # PWA manifest and icons
    location ~* \.(json|png|svg|ico)$ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1d;
        add_header Cache-Control "public, max-age=86400";
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/solmate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d playsolmates.app -d www.playsolmates.app

# Auto-renewal is configured automatically
```

## PM2 Process Management

```bash
# Install PM2 globally
npm install -g pm2

# Start the app
pm2 start server.mjs --name solmate

# Save process list
pm2 save

# Setup startup script
pm2 startup

# Monitor
pm2 monit

# Logs
pm2 logs solmate
```

## MongoDB Setup

### Local MongoDB

```bash
# Install MongoDB (Ubuntu/Debian)
sudo apt install mongodb

# Start service
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Create database and user
mongosh
> use solmate
> db.createUser({user: "solmate", pwd: "your-password", roles: ["readWrite"]})
```

### MongoDB Atlas (Cloud)

1. Create account at https://cloud.mongodb.com
2. Create a cluster
3. Get connection string
4. Set `MONGO_URL` in `.env`

## Switching to Mainnet

1. Update `.env`:
   ```
   NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta
   NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
   ```

2. Use a dedicated RPC provider for production (Helius, QuickNode, Alchemy)

3. Update `DEVELOPER_WALLET` to your mainnet wallet

4. Rebuild and restart:
   ```bash
   yarn build
   pm2 restart solmate
   ```

## Ports Used

| Port | Service | Notes |
|------|---------|-------|
| 3000 | Next.js + Socket.io | Internal, behind Nginx |
| 80 | Nginx (HTTP) | Redirects to HTTPS |
| 443 | Nginx (HTTPS) | Public facing |
| 27017 | MongoDB | Local only |

## Troubleshooting

### Socket.io not connecting
- Ensure Nginx is properly proxying WebSocket connections
- Check that `Upgrade` and `Connection` headers are set
- Verify no firewall is blocking WebSocket

### MWA not working
- Must be served over HTTPS
- Check that `NEXT_PUBLIC_APP_URL` is correct
- MWA only works on Android devices

### PWA not installing
- Must be served over HTTPS
- Check manifest.json is accessible
- Verify service worker is registered
- Icons must be valid PNG files

### Payment verification failing
- Ensure `DEVELOPER_WALLET` matches your actual wallet
- Check `NEXT_PUBLIC_SOLANA_CLUSTER` matches your RPC
- Verify USDC mint address is correct for the network

## File Structure

```
solmate/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   └── page.js            # Main page
├── components/            # React components
│   ├── chess/            # Chess board components
│   ├── game/             # Game screens
│   ├── wallet/           # Wallet integration
│   └── ui/               # UI components (shadcn)
├── hooks/                 # Custom React hooks
├── lib/                   # Utilities and config
│   ├── db/               # Database connection
│   ├── i18n/             # Internationalization
│   └── socket/           # Socket.io server/client
├── messages/             # i18n translation files
├── public/               # Static files
│   ├── wallets/          # Wallet icons
│   ├── manifest.json     # PWA manifest
│   └── sw.js             # Service worker
├── server.mjs            # Custom server with Socket.io
├── .env.example          # Environment template
└── package.json
```

## Support

For issues, check the console logs:
- Server logs: `pm2 logs solmate`
- Browser console: F12 → Console tab

## Security Checklist

- [ ] Strong `JWT_SECRET` (64+ random characters)
- [ ] MongoDB authentication enabled
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Firewall configured (only 80, 443 open)
- [ ] MongoDB port (27017) not exposed publicly
- [ ] Regular backups configured
