# PlaySolMates - Production Deployment Guide

## Overview
PlaySolMates is a Next.js 14 application with MongoDB backend, featuring:
- Email/Password authentication with OTP verification
- Solana wallet authentication
- Real-time chess gameplay via Socket.io
- Multi-language support (EN, DE, AR, ZH)
- VIP system with USDC payments

---

## System Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| npm/yarn | npm 9+ / yarn 1.22+ | yarn 1.22+ |
| MongoDB | 5.0+ | 6.0+ (or MongoDB Atlas) |
| RAM | 1GB | 2GB+ |
| CPU | 1 core | 2+ cores |
| Disk | 5GB | 20GB+ |

---

## Pre-Deployment Checklist

### 1. Environment Variables
Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

**CRITICAL - Must Change:**
- [ ] `NEXT_PUBLIC_BASE_URL` - Your production domain
- [ ] `NEXTAUTH_URL` - Same as above
- [ ] `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- [ ] `JWT_SECRET` - Generate with `openssl rand -base64 32`
- [ ] `MONGO_URL` - Your MongoDB connection string
- [ ] `SMTP_PASS` - Your Zoho app password
- [ ] `EMAIL_FROM` - Your email address
- [ ] `DEVELOPER_WALLET` - Your Solana wallet for payments

### 2. Generate Secure Secrets
```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### 3. MongoDB Setup
Ensure MongoDB is running and accessible. For production, we recommend:
- MongoDB Atlas (managed)
- Or self-hosted with authentication enabled

---

## Installation

### Step 1: Install Dependencies
```bash
cd /path/to/app
yarn install --frozen-lockfile
```

### Step 2: Build for Production
```bash
yarn build
```

This creates an optimized production build in `.next/` folder.

### Step 3: Verify Build
Check for any build errors. The build should complete without errors.

---

## Running in Production

### Option A: Using PM2 (Recommended)

#### Install PM2 globally:
```bash
npm install -g pm2
```

#### Create PM2 ecosystem file:
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'playsolmates',
    script: 'node_modules/next/dist/bin/next',
    args: 'start -p 3000',
    cwd: '/path/to/app',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

#### Start with PM2:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Enable auto-start on system boot
```

#### PM2 Commands:
```bash
pm2 status           # Check status
pm2 logs playsolmates # View logs
pm2 restart playsolmates # Restart app
pm2 stop playsolmates    # Stop app
```

### Option B: Using Node Directly
```bash
NODE_ENV=production yarn start
# or
NODE_ENV=production node_modules/.bin/next start -p 3000
```

### Option C: Using Custom Server (server.mjs)
The app includes a custom server with Socket.io support:
```bash
NODE_ENV=production node server.mjs
```

---

## Reverse Proxy Setup (Nginx)

### Sample Nginx Configuration:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Proxy settings
    location / {
        proxy_pass http://127.0.0.1:3000;
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
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

---

## Email System Configuration

### Zoho Mail Setup:
1. Login to Zoho Mail admin
2. Go to Settings → Mail Accounts → Your Account
3. Generate an App Password (2FA must be enabled)
4. Use these settings in `.env`:
   ```
   SMTP_HOST=smtp.zoho.eu
   SMTP_PORT=587
   SMTP_USER=noreply@yourdomain.com
   SMTP_PASS=your-app-password
   EMAIL_FROM=PlaySolMates <noreply@yourdomain.com>
   ```

### Email Features:
- ✅ Signup verification (OTP + Link)
- ✅ Password reset
- ✅ Password change confirmation

---

## SSL/HTTPS Setup

### Using Let's Encrypt (Certbot):
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal (usually automatic)
sudo certbot renew --dry-run
```

---

## Health Checks

### Verify Application:
1. **Homepage loads**: `https://yourdomain.com`
2. **API responds**: `https://yourdomain.com/api/leaderboard?period=all`
3. **Socket.io connects**: Check browser console for "Socket connected"

### Database Health:
```bash
# Connect to MongoDB
mongosh mongodb://localhost:27017/solmate

# Check collections
show collections
db.users.countDocuments()
```

---

## Troubleshooting

### Common Issues:

#### 1. "SMTP Authentication Failed"
- Verify SMTP_PASS is the App Password, not account password
- Check if 2FA is enabled on Zoho account
- Verify SMTP_USER matches the email account

#### 2. "Socket.io connection failed"
- Ensure WebSocket upgrade is allowed in nginx/proxy
- Check firewall allows port 3000 (or your chosen port)

#### 3. "MongoDB connection failed"
- Verify MONGO_URL is correct
- Check MongoDB service is running
- Verify network/firewall allows connection

#### 4. "NextAuth errors"
- Ensure NEXTAUTH_URL matches your actual domain
- Verify NEXTAUTH_SECRET is set

---

## Backup Strategy

### MongoDB Backup:
```bash
# Manual backup
mongodump --uri="mongodb://localhost:27017/solmate" --out=/backups/$(date +%Y%m%d)

# Restore
mongorestore --uri="mongodb://localhost:27017/solmate" /backups/20240101
```

### Automated Backup (cron):
```bash
# Add to crontab
0 2 * * * mongodump --uri="mongodb://localhost:27017/solmate" --out=/backups/$(date +\%Y\%m\%d) && find /backups -mtime +7 -delete
```

---

## Security Recommendations

1. **Secrets Management**
   - Never commit `.env` to version control
   - Use strong, unique secrets for JWT_SECRET and NEXTAUTH_SECRET
   - Rotate secrets periodically

2. **Database Security**
   - Enable MongoDB authentication
   - Use SSL/TLS for database connections
   - Restrict network access to database

3. **Server Security**
   - Keep Node.js and dependencies updated
   - Use a firewall (ufw, iptables)
   - Enable fail2ban for SSH

4. **Application Security**
   - HTTPS only (redirect HTTP)
   - Set secure headers (already configured in Next.js)
   - Regular security audits

---

## Support

For issues or questions:
- Check server logs: `pm2 logs playsolmates`
- Check MongoDB logs
- Review `.next/` build output for errors

---

## Quick Reference Commands

```bash
# Build
yarn build

# Start (production)
yarn start

# Start with PM2
pm2 start ecosystem.config.js

# View logs
pm2 logs playsolmates

# Restart
pm2 restart playsolmates

# Check status
pm2 status
```
