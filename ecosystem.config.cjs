// PM2 Configuration for PlaySolMates
// Usage: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [{
    name: 'playsolmates',
    script: 'server.mjs',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000
  }]
};
