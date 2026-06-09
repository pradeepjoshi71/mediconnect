'use strict';

const { Pool } = require('pg');

// ─── Neon Free Tier Limits ────────────────────────────────────────────────────
// Neon free tier: max 5 concurrent connections per branch (shared with
// Neon's own internal connection). We cap our pool at 4 to leave headroom.
// Render free tier spins down; keepAlive re-uses TCP sockets so every
// warm-path query skips the TCP handshake overhead.
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  // ── Connection identity ───────────────────────────────────────────────────
  connectionString: process.env.DATABASE_URL,   // Neon gives a single pooled URL
  application_name: process.env.DB_APP_NAME || 'mediconnect-backend',

  // ── Neon Free Tier pool constraints ──────────────────────────────────────
  max: Number(process.env.DB_POOL_MAX || 4),         // Hard cap — never exceed Neon's 5-connection limit
  min: 0,                                             // Release all connections when idle (Render sleeps)
  idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT_MS || 10000),        // Harvest idle clients after 10 s
  connectionTimeoutMillis: Number(process.env.DB_CONNECTION_TIMEOUT_MS || 5000), // Fail fast on cold DB

  // ── Keep-alive: prevents "connection reset by peer" on Neon's 5-min ──────
  // idle-connection pruner and Render's TCP teardown during sleep.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000, // Start sending keepalive probes after 10 s of idle

  // ── SSL: required by Neon, rejected by local pg without DB_SSL=true ──────
  ssl: process.env.DB_SSL === 'false'
    ? undefined
    : {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      },
});

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
