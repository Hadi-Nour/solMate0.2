// PM2 Ecosystem Configuration for SolMate Production
// Usage: pm2 start ecosystem.config.js --env production
// See: https://pm2.keymetrics.io/docs/usage/application-declaration/

module.exports = {
  apps: [
    {
      name: 'solmate',
      script: 'server.mjs',
      
      // Instances & Clustering
      instances: 1, // Single instance for Socket.io (sticky sessions needed for clustering)
      exec_mode: 'fork', // Fork mode for Socket.io compatibility
      
      // Environment
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      
      // Memory Management
      max_memory_restart: '512M',
      node_args: '--max-old-space-size=512',
      
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/log/pm2/solmate-error.log',
      out_file: '/var/log/pm2/solmate-out.log',
      merge_logs: true,
      
      // Process Management
      autorestart: true,
      watch: false,
      max_restarts: 10,
      restart_delay: 4000,
      min_uptime: '10s',
      
      // Graceful Shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      shutdown_with_message: true,
      
      // Health Check
      exp_backoff_restart_delay: 100,
    },
  ],
};
