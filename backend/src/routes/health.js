'use strict';

/**
 * health.js — Production-grade /api/health endpoint.
 *
 * Verifies three subsystems in parallel and returns a strict JSON payload:
 *   1. PostgreSQL (Neon) — live query probe
 *   2. Cloudflare R2    — HeadBucket probe via AWS SDK v3
 *   3. Node.js heap     — V8 memory snapshot for leak monitoring
 *
 * Unauthenticated — safe for Render uptime monitors, the keep-alive cron,
 * and external status-page scrapers.
 *
 * Mount in app.js (replaces the basic stubs on lines 108–118):
 *   const healthRouter = require('./routes/health');
 *   app.use('/api/health', healthRouter);     // → GET /api/health
 *   app.use('/health',     healthRouter);     // → GET /health (Render probe)
 *   app.use('/api/v1/health', healthRouter);  // → GET /api/v1/health (compat)
 */

const express    = require('express');
const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
const db         = require('../config/db');

const router = express.Router();

// ─── Heap thresholds (beta leak monitoring) ───────────────────────────────────
const HEAP_WARN_MB  = Number(process.env.HEAP_WARN_MB  || 400); // warn above 400 MB
const HEAP_CRIT_MB  = Number(process.env.HEAP_CRIT_MB  || 700); // critical above 700 MB

// ─── R2 client (singleton — reused across health checks) ─────────────────────
let _r2Client = null;
function getR2Client() {
  if (_r2Client) return _r2Client;
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    return null; // R2 not configured — treated as 'unconfigured', not 'down'
  }
  _r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
  return _r2Client;
}

// ─── Individual probe functions ───────────────────────────────────────────────

/**
 * Probe 1 — PostgreSQL
 * Runs `SELECT 1` against the Neon pool with a 3-second timeout guard.
 */
async function checkPostgres() {
  const t0 = Date.now();
  try {
    await Promise.race([
      db.query('SELECT 1'),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 3000)),
    ]);
    return { status: 'ok', latencyMs: Date.now() - t0 };
  } catch (err) {
    return { status: 'error', latencyMs: Date.now() - t0, error: err.message };
  }
}

/**
 * Probe 2 — Cloudflare R2
 * Issues a HeadBucket command — verifies credentials + bucket reachability
 * without reading or writing any data.
 */
async function checkR2() {
  const t0 = Date.now();
  const client = getR2Client();
  const bucket = process.env.R2_BUCKET_NAME;

  if (!client || !bucket) {
    return { status: 'unconfigured', latencyMs: 0, note: 'R2 env vars not set — skipped' };
  }

  try {
    await Promise.race([
      client.send(new HeadBucketCommand({ Bucket: bucket })),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000)),
    ]);
    return { status: 'ok', latencyMs: Date.now() - t0, bucket };
  } catch (err) {
    // HeadBucket returns 403 if credentials are valid but ACL restricts head —
    // still means R2 is reachable. 404 = bucket missing.
    const code = err.$metadata?.httpStatusCode;
    if (code === 403) {
      return { status: 'ok', latencyMs: Date.now() - t0, bucket, note: '403 — credentials valid, ACL restricted' };
    }
    return { status: 'error', latencyMs: Date.now() - t0, bucket, error: err.message, code };
  }
}

/**
 * Probe 3 — Node.js Heap
 * Reads V8 heap statistics and computes a severity level.
 * Returns raw bytes + human-readable MB for dashboard rendering.
 */
function checkHeap() {
  const mem  = process.memoryUsage();
  const heap = {
    usedMb:  +(mem.heapUsed  / 1024 / 1024).toFixed(1),
    totalMb: +(mem.heapTotal / 1024 / 1024).toFixed(1),
    rssMb:   +(mem.rss       / 1024 / 1024).toFixed(1),
    externalMb: +(mem.external / 1024 / 1024).toFixed(1),
    usedBytes:  mem.heapUsed,
    totalBytes: mem.heapTotal,
  };

  let level = 'ok';
  if (heap.usedMb >= HEAP_CRIT_MB) level = 'critical';
  else if (heap.usedMb >= HEAP_WARN_MB) level = 'warning';

  return { status: level, ...heap, thresholds: { warnMb: HEAP_WARN_MB, critMb: HEAP_CRIT_MB } };
}

// ─── Route handler ────────────────────────────────────────────────────────────

/**
 * GET /api/health
 *
 * Response shape:
 * {
 *   "status": "ok" | "degraded" | "critical",
 *   "timestamp": "2026-06-09T...",
 *   "uptime": 12345,          ← process uptime in seconds
 *   "version": "1.0.0",
 *   "checks": {
 *     "postgres": { "status": "ok", "latencyMs": 4 },
 *     "r2":       { "status": "ok", "latencyMs": 87, "bucket": "..." },
 *     "heap":     { "status": "ok", "usedMb": 112.3, "totalMb": 180.0, ... }
 *   }
 * }
 */
router.get('/', async (_req, res) => {
  // Run all three probes concurrently — total latency = slowest probe
  const [postgres, r2, heap] = await Promise.all([
    checkPostgres(),
    checkR2(),
    Promise.resolve(checkHeap()), // synchronous — wrap for consistency
  ]);

  // Derive overall status
  const hasError    = postgres.status === 'error' || r2.status === 'error';
  const hasCritical = heap.status === 'critical';
  const hasWarning  = heap.status === 'warning';

  let overallStatus = 'ok';
  if (hasError || hasCritical) overallStatus = 'degraded';
  else if (hasWarning) overallStatus = 'warning';

  const httpStatus = overallStatus === 'degraded' ? 503 : 200;

  return res.status(httpStatus).json({
    status:    overallStatus,
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),         // seconds since Node.js start
    version:   process.env.npm_package_version || '1.0.0',
    nodeVersion: process.version,
    checks: { postgres, r2, heap },
  });
});

// ─── Lightweight liveness probe (no DB check — pure TCP ok) ──────────────────
// Used by the GitHub Actions keep-alive cron and Render health check path.
router.get('/ping', (_req, res) => {
  res.json({ status: 'ok', ts: Date.now() });
});

module.exports = router;
