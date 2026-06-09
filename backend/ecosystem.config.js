/**
 * ecosystem.config.js — PM2 Production Configuration for MediConnect
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 save
 *   pm2 startup
 *
 * Cluster mode: spawns one worker per CPU core.
 * The backup scheduler runs only on instance 0 (controlled in app.js).
 */
module.exports = {
  apps: [
    {
      // ── Core API ────────────────────────────────────────────────────────────
      name: 'mediconnect-api',
      script: 'src/server.js',

      // Cluster mode — one process per CPU for horizontal scaling
      instances: 'max',
      exec_mode: 'cluster',

      // Restart if heap exceeds 512MB (guards against memory leaks)
      max_memory_restart: '512M',

      // Environment files — adjust path if running from a different CWD
      env_file: '../.env',

      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
        // Increase pool size slightly per worker in production
        DB_POOL_MAX: '10',
        // Raise rate limit — Nginx handles the outer limit per IP
        API_RATE_LIMIT: '300',
      },

      // ── Logging ─────────────────────────────────────────────────────────────
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      merge_logs: true,          // merge cluster worker logs into single files
      log_type: 'json',          // structured JSON logs for log aggregators

      // ── Restart policy ──────────────────────────────────────────────────────
      autorestart: true,
      restart_delay: 3000,       // wait 3s before restart after crash
      max_restarts: 10,          // stop retrying after 10 consecutive crashes
      min_uptime: '10s',         // must stay up 10s to count as a successful start

      // ── Graceful shutdown ───────────────────────────────────────────────────
      kill_timeout: 15000,       // wait 15s for SIGTERM before SIGKILL
      wait_ready: false,         // rely on listen-ready detection

      // ── Watch (dev only — disable in production) ────────────────────────────
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'uploads'],
    },
  ],
};
