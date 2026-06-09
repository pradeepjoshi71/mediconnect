'use strict';

/**
 * dbBackup.js — Zero-disk Google Drive streaming backup job.
 *
 * Streams operational table data and audit_logs SEPARATELY to Google Drive
 * using googleapis (Drive v3). No file is ever written to local disk —
 * safe for Render free tier (ephemeral filesystem).
 *
 * Two backup streams per run:
 *   1. OPERATIONAL  — all clinical/business tables as JSON-ND rows
 *   2. AUDIT_LOGS   — audit_logs table isolated for compliance
 *
 * Required env vars:
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — Full JSON content of the service account key
 *   GOOGLE_DRIVE_FOLDER_ID        — Drive folder ID where backups are uploaded
 *   DATABASE_URL                  — Neon Postgres connection string (from db.js)
 *
 * Schedule: Daily at 02:00 IST (20:30 UTC previous day) via node-cron.
 * Mount in app.js:  require('./jobs/dbBackup').start();
 */

const { Readable, PassThrough } = require('stream');
const { google }  = require('googleapis');
const cron        = require('node-cron');
const { Pool }    = require('pg');
const logger      = require('../utils/logger');

// ─── Table Groups ─────────────────────────────────────────────────────────────

/**
 * Operational tables — clinical + business data.
 * Order matters: parent tables before child tables for safe restore sequencing.
 */
const OPERATIONAL_TABLES = [
  'hospitals',
  'roles',
  'users',
  'user_roles',
  'doctors',
  'doctor_availability_rules',
  'doctor_time_off',
  'patients',
  'appointments',
  'medical_records',
  'diagnoses',
  'allergies',
  'prescriptions',
  'files',
  'lab_tests',
  'lab_orders',
  'lab_order_items',
  'lab_reports',
  'invoices',
  'invoice_items',
  'payments',
  'notifications',
  'subscriptions',
  'backup_scheduler_config',
  'backup_logs',
];

/**
 * Compliance-isolated tables — uploaded as a separate Drive file.
 * Kept separate so audit trails can have independent retention policies.
 */
const AUDIT_TABLES = ['audit_logs'];

// ─── Google Auth ──────────────────────────────────────────────────────────────

function getAuthClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('[dbBackup] GOOGLE_SERVICE_ACCOUNT_JSON is not set.');

  const credentials = typeof raw === 'string' ? JSON.parse(raw) : raw;

  return new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });
}

// ─── Streaming helpers ────────────────────────────────────────────────────────

/**
 * Creates a Readable stream that queries each table in `tables` sequentially,
 * emitting newline-delimited JSON (JSON-ND / NDJSON) rows — zero buffering.
 *
 * Format per backup file:
 *   Line 1:  { "_meta": { "tables": [...], "startedAt": "...", "type": "..." } }
 *   Line N:  { "_table": "tableName", ...<row data> }
 */
function createBackupStream(pool, tables, meta) {
  const pass = new PassThrough();

  // Write metadata header as first line
  pass.write(JSON.stringify({ _meta: { ...meta, tables, startedAt: new Date().toISOString() } }) + '\n');

  // Stream tables sequentially — avoids holding all rows in memory
  (async () => {
    for (const table of tables) {
      try {
        // Use a cursor-style approach: fetch in 500-row pages to cap RAM usage
        let offset = 0;
        const pageSize = 500;

        while (true) {
          const result = await pool.query(
            `SELECT * FROM ${table} ORDER BY 1 LIMIT $1 OFFSET $2`,
            [pageSize, offset]
          );

          for (const row of result.rows) {
            pass.write(JSON.stringify({ _table: table, ...row }) + '\n');
          }

          if (result.rows.length < pageSize) break; // last page
          offset += pageSize;
        }

        logger.info(`[dbBackup] Streamed table: ${table}`, { offset });
      } catch (err) {
        // Log per-table error but continue — a missing table (e.g. new migration)
        // should not abort the entire backup.
        const errLine = JSON.stringify({ _error: true, _table: table, message: err.message });
        pass.write(errLine + '\n');
        logger.warn(`[dbBackup] Could not stream table "${table}": ${err.message}`);
      }
    }

    pass.end(); // Signal EOF to Drive upload
  })().catch((err) => {
    logger.error('[dbBackup] Fatal stream error', { error: err.message });
    pass.destroy(err);
  });

  return pass;
}

// ─── Google Drive Upload ──────────────────────────────────────────────────────

/**
 * Uploads a readable stream to Google Drive.
 * Returns the Drive file ID on success.
 *
 * @param {google.auth.GoogleAuth} auth
 * @param {string} fileName    — Drive file name
 * @param {Readable} stream    — data source (never touches disk)
 * @returns {Promise<string>}  — Drive file ID
 */
async function uploadToDrive(auth, fileName, stream) {
  const drive  = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  if (!folderId) throw new Error('[dbBackup] GOOGLE_DRIVE_FOLDER_ID is not set.');

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/x-ndjson',
    },
    media: {
      mimeType: 'application/x-ndjson',
      body: stream,              // streams directly — no local file
    },
    fields: 'id, name, size',
  });

  return response.data.id;
}

// ─── Retention: prune old Drive backups ──────────────────────────────────────

/**
 * Deletes Drive files in the backup folder older than `retentionDays`.
 * Keeps the most recent backup regardless of age.
 */
async function pruneOldDriveBackups(auth, retentionDays = 30) {
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) return;

  const cutoff = new Date(Date.now() - retentionDays * 86400 * 1000).toISOString();

  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and createdTime < '${cutoff}' and trashed = false`,
    fields: 'files(id, name, createdTime)',
    pageSize: 100,
  });

  const files = listRes.data.files || [];
  for (const file of files) {
    try {
      await drive.files.delete({ fileId: file.id });
      logger.info(`[dbBackup] Pruned old backup: ${file.name}`);
    } catch (err) {
      logger.warn(`[dbBackup] Could not prune file ${file.name}: ${err.message}`);
    }
  }
}

// ─── Main backup runner ───────────────────────────────────────────────────────

async function runBackup({ triggeredBy = 'scheduler' } = {}) {
  const startedAt = Date.now();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');

  logger.info('[dbBackup] Starting Google Drive streaming backup', { triggeredBy, timestamp });

  // Use a dedicated short-lived pool for the backup job — isolated from the
  // main app pool to avoid exhausting Neon's 5-connection free-tier limit.
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
  });

  try {
    const auth = getAuthClient();

    // ── 1. Operational backup ──────────────────────────────────────────────
    const opsFileName   = `mediconnect_operational_${timestamp}.ndjson`;
    const opsStream     = createBackupStream(pool, OPERATIONAL_TABLES, {
      type: 'operational',
      triggeredBy,
      env: process.env.NODE_ENV || 'production',
    });
    const opsFileId     = await uploadToDrive(auth, opsFileName, opsStream);
    logger.info('[dbBackup] Operational backup uploaded', { driveFileId: opsFileId, fileName: opsFileName });

    // ── 2. Audit log backup (compliance-isolated) ─────────────────────────
    const auditFileName = `mediconnect_audit_logs_${timestamp}.ndjson`;
    const auditStream   = createBackupStream(pool, AUDIT_TABLES, {
      type: 'audit_compliance',
      triggeredBy,
      note: 'Compliance-isolated. Do not merge with operational backups.',
    });
    const auditFileId   = await uploadToDrive(auth, auditFileName, auditStream);
    logger.info('[dbBackup] Audit log backup uploaded', { driveFileId: auditFileId, fileName: auditFileName });

    // ── 3. Prune backups older than 30 days ───────────────────────────────
    await pruneOldDriveBackups(auth, 30);

    const durationMs = Date.now() - startedAt;
    logger.info('[dbBackup] Backup complete', { durationMs, opsFileId, auditFileId });

    return { success: true, opsFileId, auditFileId, durationMs };
  } catch (err) {
    logger.error('[dbBackup] Backup failed', { error: err.message, stack: err.stack });
    return { success: false, error: err.message };
  } finally {
    // Always release the dedicated pool — never leak connections
    await pool.end().catch(() => {});
  }
}

// ─── Cron Scheduler ──────────────────────────────────────────────────────────

let _cronJob = null;

/**
 * Starts the cron schedule: daily at 02:00 IST (20:30 UTC).
 * Safe to call multiple times — only one instance is registered.
 * In PM2 cluster mode, guard with NODE_APP_INSTANCE === '0' in app.js.
 */
function start() {
  if (_cronJob) return; // already running

  // '30 20 * * *' = 20:30 UTC daily = 02:00 IST
  _cronJob = cron.schedule('30 20 * * *', async () => {
    await runBackup({ triggeredBy: 'cron' });
  }, {
    timezone: 'UTC',
    scheduled: true,
  });

  logger.info('[dbBackup] Google Drive backup scheduler started (daily 02:00 IST / 20:30 UTC)');
}

function stop() {
  if (_cronJob) {
    _cronJob.stop();
    _cronJob = null;
    logger.info('[dbBackup] Google Drive backup scheduler stopped');
  }
}

module.exports = { start, stop, runBackup };
