# SolMate Production Deployment Guide
## For Hetzner Server (playsolmates.app)

---

## 📋 Prerequisites

- **Server**: Ubuntu 22.04+ or Debian 11+
- **Node.js**: v18.x or v20.x LTS
- **MongoDB**: v6.x or v7.x
- **PM2**: Process manager (recommended)
- **Nginx**: Reverse proxy with SSL
- **Domain**: playsolmates.app configured with DNS
- **Solana Wallet**: For receiving VIP payments

---

## 🔑 Required Environment Variables

### Critical (App won't work without these):
```bash
NEXTAUTH_URL=https://playsolmates.app
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
JWT_SECRET=<generate with: openssl rand -base64 32>
MONGO_URL=mongodb://localhost:27017
```

### Email Magic Link (Required for email auth):
```bash
SMTP_HOST=smtp.zoho.eu
SMTP_PORT=465
SMTP_USER=noreply@playsolmates.app
SMTP_PASS=<your-zoho-app-password>
EMAIL_FROM=SolMate <noreply@playsolmates.app>
```

### 💳 Payment Configuration (Required for VIP purchases):
```bash
# Network (IMPORTANT: use 'mainnet-beta' for real payments)
SOLANA_CLUSTER=mainnet-beta
NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta

# RPC URL - Premium RPC recommended for production
# Free: https://api.mainnet-beta.solana.com
# Premium: Helius, QuickNode, Triton, etc.
RPC_URL=https://api.mainnet-beta.solana.com
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com

# Your Solana wallet address to receive payments
DEVELOPER_WALLET=<your-solana-wallet-address>
NEXT_PUBLIC_DEVELOPER_WALLET=<your-solana-wallet-address>

# USDC Mint (don't change these)
USDC_MINT_MAINNET=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
NEXT_PUBLIC_USDC_MINT_MAINNET=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# For devnet testing only:
USDC_MINT_DEVNET=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
NEXT_PUBLIC_USDC_MINT_DEVNET=4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU

# VIP Price
VIP_PRICE_USDC=6.99
NEXT_PUBLIC_VIP_PRICE_USDC=6.99
```

### OAuth Providers (Optional - configure only what you need):
```bash
# Google
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>

# Facebook
FACEBOOK_CLIENT_ID=<from-facebook-developers>
FACEBOOK_CLIENT_SECRET=<from-facebook-developers>

# Twitter/X
TWITTER_CLIENT_ID=<from-twitter-developer-portal>
TWITTER_CLIENT_SECRET=<from-twitter-developer-portal>
```

---

## 💰 Payment System Overview

### How VIP Payments Work:
1. User connects Solana wallet (Phantom, etc.)
2. User initiates VIP purchase ($6.99 USDC)
3. Frontend creates USDC transfer transaction
4. User signs transaction in wallet
5. Transaction sent to Solana network
6. Frontend waits for confirmation
7. Backend verifies on-chain:
   - Transaction exists and is confirmed
   - USDC sent to developer wallet
   - Amount >= $6.99 USDC
   - Sender matches authenticated user
   - Signature not previously used (idempotency)
8. Backend marks user as VIP

### Security Features:
- ✅ **Server-side verification**: Never trust client "success"
- ✅ **Idempotency**: Same tx signature cannot credit twice
- ✅ **Network check**: Client verifies correct network before sending
- ✅ **Amount verification**: Exact USDC amount checked
- ✅ **Sender verification**: Must match authenticated wallet

### Network Configuration:
| Setting | Devnet (Testing) | Mainnet (Production) |
|---------|------------------|----------------------|
| `SOLANA_CLUSTER` | `devnet` | `mainnet-beta` |
| `RPC_URL` | `https://api.devnet.solana.com` | Premium RPC recommended |
| USDC Tokens | Test tokens (free) | Real USDC |

⚠️ **IMPORTANT**: The app blocks payments if wallet network doesn't match config!

---

## 🔗 OAuth Callback URLs

When setting up OAuth providers, use these exact callback URLs:

| Provider | Callback URL |
|----------|-------------|
| Google | `https://playsolmates.app/api/auth/callback/google` |
| Facebook | `https://playsolmates.app/api/auth/callback/facebook` |
| Twitter/X | `https://playsolmates.app/api/auth/callback/twitter` |

### Google Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add Authorized JavaScript origin: `https://playsolmates.app`
4. Add Authorized redirect URI: `https://playsolmates.app/api/auth/callback/google`

### Facebook Setup:
1. Go to [Facebook Developers](https://developers.facebook.com/apps)
2. Create new app → Consumer → Set up Facebook Login
3. Valid OAuth Redirect URIs: `https://playsolmates.app/api/auth/callback/facebook`
4. Enable "Allow HTTPS" and "Enforce HTTPS"

### Twitter/X Setup:
1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create Project & App → Enable OAuth 2.0
3. Type of App: Web App
4. Callback URL: `https://playsolmates.app/api/auth/callback/twitter`
5. Website URL: `https://playsolmates.app`

---

## 🚀 Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MongoDB
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod

# Install PM2 globally
sudo npm install -g pm2 yarn

# Install Nginx
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Clone & Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/solmate
sudo chown $USER:$USER /var/www/solmate

# Clone your repository (or upload files)
cd /var/www/solmate
git clone <your-repo-url> .

# Install dependencies
yarn install

# Create environment file
cp .env.example .env
nano .env  # Fill in all required values

# Build for production
yarn build
```

### 3. Configure PM2

```bash
# Create PM2 log directory
sudo mkdir -p /var/log/pm2
sudo chown $USER:$USER /var/log/pm2

# Start application
cd /var/www/solmate
pm2 start ecosystem.config.js --env production

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u $USER --hp /home/$USER
```

### 4. Configure Nginx

Create `/etc/nginx/sites-available/solmate`:

```nginx
# Upstream for Next.js + Socket.io
upstream solmate_backend {
    server 127.0.0.1:3000;
    keepalive 64;
}

server {
    listen 80;
    server_name playsolmates.app www.playsolmates.app;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name playsolmates.app www.playsolmates.app;

    # SSL (will be configured by certbot)
    ssl_certificate /etc/letsencrypt/live/playsolmates.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/playsolmates.app/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;

    # Main location
    location / {
        proxy_pass http://solmate_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # Socket.io specific
    location /socket.io/ {
        proxy_pass http://solmate_backend;
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
        proxy_pass http://solmate_backend;
        proxy_cache_valid 60m;
        add_header Cache-Control "public, immutable, max-age=31536000";
    }

    # Favicon and static assets
    location ~* \.(ico|css|js|gif|jpeg|jpg|png|woff|woff2|ttf|svg|eot)$ {
        proxy_pass http://solmate_backend;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

Enable and test:

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/solmate /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Get SSL certificate
sudo certbot --nginx -d playsolmates.app -d www.playsolmates.app

# Reload Nginx
sudo systemctl reload nginx
```

### 5. Verify Deployment

```bash
# Check PM2 status
pm2 status

# View logs
pm2 logs solmate

# Check if site is accessible
curl -I https://playsolmates.app
```

---

## 📊 Monitoring & Maintenance

### View Logs
```bash
# PM2 logs (real-time)
pm2 logs solmate

# Application logs
tail -f /var/log/pm2/solmate-out.log
tail -f /var/log/pm2/solmate-error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Restart Application
```bash
# Graceful restart
pm2 reload solmate

# Hard restart
pm2 restart solmate
```

### Deploy Updates
```bash
cd /var/www/solmate

# Pull latest changes
git pull origin main

# Install any new dependencies
yarn install

# Rebuild
yarn build

# Restart
pm2 reload solmate
```

### Backup MongoDB
```bash
# Create backup
mongodump --db solmate --out /backup/$(date +%Y%m%d)

# Restore from backup
mongorestore --db solmate /backup/20250125/solmate
```

---

## 🔒 Security Checklist

- [ ] All secrets in `.env` are unique and strong (32+ chars)
- [ ] `.env` file permissions: `chmod 600 .env`
- [ ] MongoDB authentication enabled (optional but recommended)
- [ ] Firewall configured (only 80, 443, 22 open)
- [ ] SSL certificate installed and auto-renewing
- [ ] Debug flags disabled (`NEXT_PUBLIC_DEBUG_QUICKCHAT=false`)
- [ ] PM2 log rotation configured

### Configure Firewall (UFW)
```bash
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable
```

### PM2 Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 🆘 Troubleshooting

### App not starting
```bash
# Check PM2 logs
pm2 logs solmate --lines 100

# Check if port 3000 is in use
sudo lsof -i :3000
```

### Socket.io not connecting
- Verify Nginx WebSocket configuration
- Check `proxy_read_timeout` is set high enough
- Ensure `Connection: upgrade` header is passed

### Email not sending
```bash
# Test SMTP connection
openssl s_client -connect smtp.zoho.eu:465

# Check application logs for email errors
pm2 logs solmate | grep -i email
```

### MongoDB connection issues
```bash
# Check MongoDB status
sudo systemctl status mongod

# Verify connection
mongosh --eval "db.adminCommand('ping')"
```

---

## 📁 Files Changed for Production

1. `/app/api/auth/[...nextauth]/route.js` - Providers now conditionally loaded based on ENV
2. `/components/game/QuickChat.jsx` - Debug overlay hidden by default
3. `/.env.example` - Complete template with all required variables
4. `/ecosystem.config.js` - PM2 configuration (already existed)
5. `/DEPLOYMENT.md` - This deployment guide
6. `/hooks/useVipPayment.js` - Payment hook with network verification and timeouts
7. `/components/dialogs/VipDialog.jsx` - Payment UI with status indicators
8. `/app/api/[[...path]]/route.js` - Payment verification with enhanced logging

---

## ✅ Payment Test Checklist

### Pre-Deployment Tests (Devnet):
```bash
# Set devnet in .env
SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_RPC_URL=https://api.devnet.solana.com
```

- [ ] Connect Phantom wallet (switch to Devnet)
- [ ] Get devnet USDC from faucet
- [ ] Click "Pay USDC" in VIP dialog
- [ ] Verify wallet prompts for signature
- [ ] Approve transaction
- [ ] Watch status: Sending → Confirming → Verifying → Success
- [ ] Check explorer link works
- [ ] Verify user marked as VIP in database
- [ ] Try same transaction again (should fail - idempotency)
- [ ] Test with wrong network (should show error)

### Post-Deployment Tests (Mainnet):
- [ ] Verify payment config in logs: `[Payment] Config loaded: cluster=mainnet-beta`
- [ ] Test wallet connection
- [ ] Verify network indicator shows "Mainnet"
- [ ] Test "insufficient balance" error with empty wallet
- [ ] Complete a real $6.99 USDC payment
- [ ] Verify VIP activation
- [ ] Check transaction in MongoDB `transactions` collection

### Error Scenarios to Test:
| Scenario | Expected Behavior |
|----------|-------------------|
| Wallet not connected | "Please connect your wallet first" |
| Not authenticated | "Please sign in before making a purchase" |
| Wrong network | "Wrong network! App is configured for X but wallet is on Y" |
| Insufficient USDC | "Insufficient USDC balance. You have X, need 6.99" |
| User rejects signature | "Transaction was cancelled" |
| Network timeout | "Transaction confirmation timed out..." |
| Already VIP | "You already have VIP access" |
| Duplicate signature | "Transaction signature already used" |

---

## 📋 Expected Server Logs

### Successful Payment:
```
[Payment] Config loaded: cluster=mainnet-beta, wallet=ABCD1234...
[Payment] Processing VIP payment for <user-wallet>, sig: EFGH5678...
[Payment] Fetching transaction from mainnet-beta...
[Payment] Transaction found in slot 123456789, verifying...
[Payment] Developer wallet received 6.99 USDC
[Payment] ✅ VIP activated for <user-wallet> - 6.99 USDC on mainnet-beta
```

### Failed Payment (Wrong Amount):
```
[Payment] Processing VIP payment for <user-wallet>, sig: WXYZ9012...
[Payment] Fetching transaction from mainnet-beta...
[Payment] Transaction found in slot 123456790, verifying...
[Payment] Verification failed: ["Insufficient amount. Expected 6.99 USDC, received 1.00 USDC"]
```

### Duplicate Signature:
```
[Payment] Processing VIP payment for <user-wallet>, sig: EFGH5678...
[Payment] Duplicate signature rejected: EFGH5678...
```

### Missing Configuration:
```
[Payment] Missing configuration: DEVELOPER_WALLET, RPC_URL
[Payment] Rejecting payment - system not configured
```

---

## 🔧 Payment Troubleshooting

### Payment stuck on "Confirming"
```bash
# Check RPC connection
curl -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  https://api.mainnet-beta.solana.com

# Consider using premium RPC (Helius, QuickNode)
```

### Transaction not found
- Check wallet is on correct network (mainnet vs devnet)
- Wait longer - network congestion can delay confirmations
- Verify signature format is correct (base58, 64+ chars)

### Payment verified but VIP not active
```bash
# Check MongoDB
mongosh solmate --eval 'db.users.findOne({wallet: "YOUR_WALLET"})'

# Check transaction was recorded
mongosh solmate --eval 'db.transactions.findOne({signature: "TX_SIGNATURE"})'
```

### RPC Rate Limited
```bash
# Use premium RPC provider
# Helius: https://www.helius.dev/
# QuickNode: https://www.quicknode.com/
# Replace RPC_URL in .env
```

---

## 📞 Support

For issues specific to this deployment, check:
- PM2 logs: `pm2 logs solmate`
- Nginx logs: `/var/log/nginx/error.log`
- Application logs: `/var/log/pm2/solmate-*.log`
- Payment logs: `pm2 logs solmate | grep Payment`
