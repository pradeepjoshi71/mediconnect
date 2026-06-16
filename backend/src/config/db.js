'use strict';

const { Pool } = require('pg');

// ─── Neon Free Tier Limits ────────────────────────────────────────────────────
// Neon free tier: max 5 concurrent connections per branch (shared with
// Neon's own internal connection). We cap our pool at 4 to leave headroom.
// Render free tier spins down; keepAlive re-uses TCP sockets so every
// warm-path query skips the TCP handshake overhead.
// ─────────────────────────────────────────────────────────────────────────────

const poolConfig = {
  application_name: process.env.DB_APP_NAME || 'mediconnect-backend',
  max: Number(process.env.DB_POOL_MAX || 4),
  min: 0,
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  ssl: process.env.DB_SSL === 'false'
    ? undefined
    : {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} else {
  poolConfig.user = process.env.DB_USER;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.host = process.env.DB_HOST;
  poolConfig.database = process.env.DB_NAME;
  poolConfig.port = Number(process.env.DB_PORT || 5432);
}

const pool = new Pool(poolConfig);

// ─── Pool event hooks ─────────────────────────────────────────────────────────
pool.on('connect', (client) => {
  // Enforce UTC on every new connection — critical for healthcare timestamps.
  client.query("SET timezone = 'UTC'").catch(() => {});
});

pool.on('error', (err) => {
  // Log unexpected errors on idle clients; do NOT crash the process.
  console.error('[db] Unexpected pool client error:', err.message);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function withTransaction(handler) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Convenience: run a single parameterised query using the pool.
 * Automatically returns a client to the pool after the query completes.
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.debug(`[db] query (${Date.now() - start}ms)`, text.slice(0, 80));
  }
  return result;
}

module.exports = {
  pool,
  query,
  withTransaction,
};
