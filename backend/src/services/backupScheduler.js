/**
 * backupScheduler.js
 *
 * Production-grade backup scheduler.
 *
 * Database backup:
 *   - Runs pg_dump -Fc to /backups/db_<timestamp>.dump
 *   - Verifies dump via PGDMP magic bytes
 *   - Prunes dumps older than retentionDays
 *   - Falls back to DB-size probe when BACKUP_DIR is unset (dev mode)
 *
 * Storage backup:
 *   - Runs `mc mirror <primary> <backup>` for all MinIO buckets
 *   - Records object count from mc output
 *   - Falls back to health-check simulation when MC_PATH / MINIO_BACKUP_ALIAS
 *     is unset (dev mode)
 *
 * Lifecycle: call start() once from app startup; call stop() on shutdown.
 * In PM2 cluster mode, only instance 0 runs the scheduler (enforced in server.js).
 */

const { execFile } = require('child_process');
const fs  = require('fs');
const path = require('path');
const util = require('util');

const db = require('../config/db');
const minioService = require('./minioService');
const firebaseService = require('./firebaseService');
const logger = require('../utils/logger');

const execFileAsync = util.promisify(execFile);

// ─── Configuration ─────────────────────────────────────────────────────────────

/** Directory where .dump files are written. Unset = dev simulation mode. */
const BACKUP_DIR = process.env.BACKUP_DIR || '';

/** Full path to the mc binary. Unset = dev simulation mode for storage. */
const MC_PATH = process.env.MC_PATH || 'mc';

/** mc alias name for the primary MinIO instance (configured at deploy time). */
const MINIO_PRIMARY_ALIAS = process.env.MINIO_PRIMARY_ALIAS || 'mediconnect-primary';

/** mc alias name for the backup MinIO instance. */
const MINIO_BACKUP_ALIAS = process.env.MINIO_BACKUP_ALIAS || '';

// ─── Internal state ────────────────────────────────────────────────────────────
const timers = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nextDailyRun(cronExpression) {
  const parts = (cronExpression || '0 2 * * *').trim().split(/\s+/);
  if (parts[0] && parts[0].startsWith('*/')) {
    const mins = parseInt(parts[0].replace('*/', ''), 10) || 5;
    const now = new Date();
    return new Date(now.getTime() + mins * 60 * 1000);
  }
  
  const minute = parseInt(parts[0], 10) || 0;
  const hour   = parseInt(parts[1], 10) || 2;
  const now  = new Date();
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

async function writeLog({ type, status, durationMs, sizeBytes, retentionDays, message, errorDetail, triggeredBy = 'scheduler', startedAt, completedAt }) {
  try {
    await db.query(
      `INSERT INTO backup_logs
         (backup_type, status, duration_ms, size_bytes, retention_days, message, error_detail, triggered_by, started_at, completed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [type, status, durationMs || null, sizeBytes || null, retentionDays || 7, message || null, errorDetail || null, triggeredBy, startedAt, completedAt]
    );
  } catch (err) {
    logger.error('BackupScheduler: failed to write backup_log', { error: err.message });
  }
}

async function updateConfig({ type, status, nextRunAt, retentionDays }) {
  try {
    const col = status === 'success' ? 'success_count' : 'failed_count';
    await db.query(
      `UPDATE backup_scheduler_config
       SET last_run_at     = now(),
           last_run_status = $1,
           next_run_at     = $2,
           ${col}          = ${col} + 1,
           updated_at      = now()
       WHERE backup_type = $3`,
      [status, nextRunAt, type]
    );
  } catch (err) {
    logger.error('BackupScheduler: failed to update scheduler config', { error: err.message });
  }
}

// ─── Periodic Job Runners ──────────────────────────────────────────────────────

async function runNotificationJob(opts = {}) {
  const startedAt = new Date();
  const triggeredBy = opts.triggeredBy || 'scheduler';
  try {
    const queuedRes = await db.query(
      `SELECT id, user_id, title, body, data
       FROM notifications
       WHERE status = 'queued' AND channel = 'push'
       LIMIT 50`
    );
    
    let processed = 0;
    for (const row of queuedRes.rows) {
      try {
        const fcmResult = await firebaseService.sendToUser({
          userId: row.user_id,
          title: row.title,
          body: row.body,
          data: row.data
        });
        const status = fcmResult && fcmResult.sent > 0 ? 'sent' : 'failed';
        await db.query(`UPDATE notifications SET status = $1 WHERE id = $2`, [status, row.id]);
        processed++;
      } catch (err) {
        await db.query(`UPDATE notifications SET status = 'failed' WHERE id = $2`, [row.id]);
      }
    }
    
    const completedAt = new Date();
    await writeLog({
      type: 'notification_job',
      status: 'success',
      durationMs: completedAt - startedAt,
      message: `Processed ${processed} queued push notifications successfully.`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: true };
  } catch (err) {
    const completedAt = new Date();
    await writeLog({
      type: 'notification_job',
      status: 'failure',
      durationMs: completedAt - startedAt,
      errorDetail: err.stack,
      message: `Notification job failed: ${err.message}`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: false, error: err };
  }
}

async function runPushRetryJob(opts = {}) {
  const startedAt = new Date();
  const triggeredBy = opts.triggeredBy || 'scheduler';
  try {
    const failedRes = await db.query(
      `SELECT id, user_id, title, body, data
       FROM notifications
       WHERE status = 'failed' AND channel = 'push' AND created_at >= now() - interval '24 hours'
       LIMIT 50`
    );
    
    let retried = 0;
    let succeeded = 0;
    for (const row of failedRes.rows) {
      try {
        const fcmResult = await firebaseService.sendToUser({
          userId: row.user_id,
          title: row.title,
          body: row.body,
          data: row.data
        });
        if (fcmResult && fcmResult.sent > 0) {
          await db.query(`UPDATE notifications SET status = 'sent' WHERE id = $1`, [row.id]);
          succeeded++;
        }
        retried++;
      } catch (err) {
        // keep failed
      }
    }
    
    const completedAt = new Date();
    await writeLog({
      type: 'push_retry_job',
      status: 'success',
      durationMs: completedAt - startedAt,
      message: `Retried ${retried} failed push notifications. Succeeded: ${succeeded}.`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: true };
  } catch (err) {
    const completedAt = new Date();
    await writeLog({
      type: 'push_retry_job',
      status: 'failure',
      durationMs: completedAt - startedAt,
      errorDetail: err.stack,
      message: `Push retry job failed: ${err.message}`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: false, error: err };
  }
}

async function runCleanupJob(opts = {}) {
  const startedAt = new Date();
  const triggeredBy = opts.triggeredBy || 'scheduler';
  const retentionDays = opts.retentionDays || 7;
  try {
    let prunedFiles = 0;
    if (BACKUP_DIR && fs.existsSync(BACKUP_DIR)) {
      const cutoff = Date.now() - retentionDays * 86400 * 1000;
      const files = fs.readdirSync(BACKUP_DIR);
      for (const file of files) {
        if (!file.endsWith('.dump')) continue;
        const full = path.join(BACKUP_DIR, file);
        const stat = fs.statSync(full);
        if (stat.mtime.getTime() < cutoff) {
          fs.unlinkSync(full);
          prunedFiles++;
        }
      }
    }
    
    const notifyPrune = await db.query(
      `DELETE FROM notifications WHERE created_at < now() - interval '30 days'`
    );
    
    const logsPrune = await db.query(
      `DELETE FROM backup_logs WHERE started_at < now() - interval '90 days'`
    );
    
    const completedAt = new Date();
    await writeLog({
      type: 'cleanup_job',
      status: 'success',
      durationMs: completedAt - startedAt,
      message: `Cleanup completed. Pruned ${prunedFiles} backup files, ${notifyPrune.rowCount} notifications, and ${logsPrune.rowCount} backup logs.`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: true };
  } catch (err) {
    const completedAt = new Date();
    await writeLog({
      type: 'cleanup_job',
      status: 'failure',
      durationMs: completedAt - startedAt,
      errorDetail: err.stack,
      message: `Cleanup job failed: ${err.message}`,
      triggeredBy,
      startedAt,
      completedAt
    });
    return { success: false, error: err };
  }
}

// ─── Database Backup ───────────────────────────────────────────────────────────

/**
 * Verify a pg_dump file is valid by checking the PGDMP magic bytes
 * (first 5 bytes of a custom-format dump).
 */
function verifyDumpFile(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(5);
    fs.readSync(fd, buf, 0, 5, 0);
    fs.closeSync(fd);
    return buf.toString('ascii') === 'PGDMP';
  } catch {
    return false;
  }
}

/**
 * Prune .dump files older than retentionDays from BACKUP_DIR.
 */
function pruneOldDumps(retentionDays) {
  try {
    const cutoff = Date.now() - retentionDays * 86400 * 1000;
    for (const file of fs.readdirSync(BACKUP_DIR)) {
      if (!file.endsWith('.dump')) continue;
      const full = path.join(BACKUP_DIR, file);
      const { mtimeMs } = fs.statSync(full);
      if (mtimeMs < cutoff) {
        fs.unlinkSync(full);
        logger.info('BackupScheduler: pruned old dump', { file });
      }
    }
  } catch (err) {
    logger.warn('BackupScheduler: could not prune old dumps', { error: err.message });
  }
}

/**
 * Production pg_dump backup.
 *
 * Writes a compressed custom-format dump to:
 *   $BACKUP_DIR/db_<YYYYMMDD_HHmmss>.dump
 *
 * Uses environment variables for connection:
 *   DB_HOST, DB_PORT, DB_USER, DB_NAME, PGPASSWORD
 */
async function runPgDump(dumpPath) {
  const args = [
    '--format=custom',       // Fc — compressed, supports parallel restore
    '--no-password',
    `--host=${process.env.DB_HOST || 'localhost'}`,
    `--port=${process.env.DB_PORT || '5432'}`,
    `--username=${process.env.DB_USER || 'postgres'}`,
    `--file=${dumpPath}`,
    process.env.DB_NAME || 'mediconnect',
  ];

  const env = {
    ...process.env,
    PGPASSWORD: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
  };

  await execFileAsync('pg_dump', args, { env, timeout: 300_000 }); // 5-min timeout
}

async function runDatabaseBackup({ retentionDays = 7, triggeredBy = 'scheduler' } = {}) {
  const startedAt = new Date();
  const t0 = Date.now();

  logger.info('BackupScheduler: starting database backup', { triggeredBy, mode: BACKUP_DIR ? 'pg_dump' : 'simulation' });

  // ── Simulation mode (dev — BACKUP_DIR not set) ──────────────────────────
  if (!BACKUP_DIR) {
    try {
      const sizeRes = await db.query(`SELECT pg_database_size(current_database()) AS size_bytes`);
      const sizeBytes = parseInt(sizeRes.rows[0]?.size_bytes, 10) || 0;
      const duration = Date.now() - t0;
      await writeLog({
        type: 'database', status: 'success', durationMs: duration, sizeBytes, retentionDays,
        message: `[DEV] Database snapshot simulated. Size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB. Set BACKUP_DIR to enable real pg_dump.`,
        triggeredBy, startedAt, completedAt: new Date(),
      });
      await db.query(
        `DELETE FROM backup_logs WHERE backup_type = 'database' AND started_at < now() - ($1 || ' days')::interval`,
        [retentionDays]
      );
      logger.info('BackupScheduler: database backup simulated (dev mode)', { sizeBytes });
      return { success: true, sizeBytes, durationMs: duration, mode: 'simulation' };
    } catch (err) {
      const duration = Date.now() - t0;
      await writeLog({ type: 'database', status: 'failure', durationMs: duration, retentionDays, message: 'Database simulation failed.', errorDetail: err.message, triggeredBy, startedAt, completedAt: new Date() });
      logger.error('BackupScheduler: database simulation failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  // ── Production mode — real pg_dump ──────────────────────────────────────
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
  const dumpPath = path.join(BACKUP_DIR, `db_${ts}.dump`);

  try {
    // Ensure backup directory exists
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    await runPgDump(dumpPath);

    // Get real file size
    const { size: sizeBytes } = fs.statSync(dumpPath);

    // Verify dump integrity via PGDMP magic bytes
    const valid = verifyDumpFile(dumpPath);
    if (!valid) {
      throw new Error(`Dump file failed integrity check: ${dumpPath}`);
    }

    const duration = Date.now() - t0;

    await writeLog({
      type: 'database', status: 'success', durationMs: duration, sizeBytes, retentionDays,
      message: `pg_dump completed. File: ${path.basename(dumpPath)}, Size: ${(sizeBytes / 1024 / 1024).toFixed(2)} MB. Integrity: OK. Retention: ${retentionDays} days.`,
      triggeredBy, startedAt, completedAt: new Date(),
    });

    // Prune old dumps + purge old log entries
    pruneOldDumps(retentionDays);
    await db.query(
      `DELETE FROM backup_logs WHERE backup_type = 'database' AND started_at < now() - ($1 || ' days')::interval`,
      [retentionDays]
    );

    logger.info('BackupScheduler: pg_dump succeeded', { dumpPath, sizeBytes, durationMs: duration });
    return { success: true, sizeBytes, durationMs: duration, dumpPath, mode: 'pg_dump' };
  } catch (err) {
    // Clean up partial dump if it exists
    try { if (fs.existsSync(dumpPath)) fs.unlinkSync(dumpPath); } catch {}

    const duration = Date.now() - t0;
    await writeLog({ type: 'database', status: 'failure', durationMs: duration, retentionDays, message: 'pg_dump failed.', errorDetail: err.message, triggeredBy, startedAt, completedAt: new Date() });
    logger.error('BackupScheduler: pg_dump failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── MinIO Storage Backup (mc mirror) ─────────────────────────────────────────

/**
 * Run mc mirror to replicate all MinIO buckets to the backup alias.
 * Returns parsed stats: { objectCount, totalBytes }.
 */
async function runMcMirror() {
  // Mirror all buckets from primary to backup alias
  const { stdout } = await execFileAsync(
    MC_PATH,
    ['mirror', '--overwrite', '--remove', `${MINIO_PRIMARY_ALIAS}/`, `${MINIO_BACKUP_ALIAS}/`],
    { timeout: 600_000 } // 10-min timeout for large buckets
  );

  // Parse object count from mc output (e.g. "Total: 42 objects, 123456789 bytes")
  const objectMatch = stdout.match(/(\d+)\s+object/i);
  const bytesMatch  = stdout.match(/(\d+)\s+bytes/i);
  return {
    objectCount: objectMatch ? parseInt(objectMatch[1], 10) : null,
    totalBytes:  bytesMatch  ? parseInt(bytesMatch[1],  10) : null,
  };
}

async function runStorageBackup({ retentionDays = 7, triggeredBy = 'scheduler' } = {}) {
  const startedAt = new Date();
  const t0 = Date.now();
  const productionMode = !!(MINIO_BACKUP_ALIAS);

  logger.info('BackupScheduler: starting storage backup', { triggeredBy, mode: productionMode ? 'mc-mirror' : 'simulation' });

  // ── Simulation mode (dev — MINIO_BACKUP_ALIAS not set) ──────────────────
  if (!productionMode) {
    try {
      const ok = await minioService.healthCheck();
      if (!ok) throw new Error('MinIO health check failed — service unreachable');
      const duration = Date.now() - t0;
      const bucketCount = minioService.DEFAULT_BUCKETS.length;
      await writeLog({
        type: 'storage', status: 'success', durationMs: duration, retentionDays,
        message: `[DEV] MinIO health check passed. ${bucketCount} buckets reachable. Set MINIO_BACKUP_ALIAS to enable real mc mirror.`,
        triggeredBy, startedAt, completedAt: new Date(),
      });
      await db.query(
        `DELETE FROM backup_logs WHERE backup_type = 'storage' AND started_at < now() - ($1 || ' days')::interval`,
        [retentionDays]
      );
      logger.info('BackupScheduler: storage backup simulated (dev mode)', { bucketCount });
      return { success: true, bucketCount, durationMs: duration, mode: 'simulation' };
    } catch (err) {
      const duration = Date.now() - t0;
      await writeLog({ type: 'storage', status: 'failure', durationMs: duration, retentionDays, message: 'Storage backup failed.', errorDetail: err.message, triggeredBy, startedAt, completedAt: new Date() });
      logger.error('BackupScheduler: storage backup failed', { error: err.message });
      return { success: false, error: err.message };
    }
  }

  // ── Production mode — real mc mirror ────────────────────────────────────
  try {
    const { objectCount, totalBytes } = await runMcMirror();
    const duration = Date.now() - t0;

    const sizeLabel = totalBytes != null ? `${(totalBytes / 1024 / 1024).toFixed(2)} MB` : 'unknown size';
    const countLabel = objectCount != null ? `${objectCount} objects` : 'unknown count';

    await writeLog({
      type: 'storage', status: 'success', durationMs: duration,
      sizeBytes: totalBytes, retentionDays,
      message: `mc mirror completed. ${countLabel}, ${sizeLabel} mirrored to ${MINIO_BACKUP_ALIAS}. Retention: ${retentionDays} days.`,
      triggeredBy, startedAt, completedAt: new Date(),
    });
    await db.query(
      `DELETE FROM backup_logs WHERE backup_type = 'storage' AND started_at < now() - ($1 || ' days')::interval`,
      [retentionDays]
    );

    logger.info('BackupScheduler: mc mirror succeeded', { objectCount, totalBytes, durationMs: duration });
    return { success: true, objectCount, totalBytes, durationMs: duration, mode: 'mc-mirror' };
  } catch (err) {
    const duration = Date.now() - t0;
    await writeLog({ type: 'storage', status: 'failure', durationMs: duration, retentionDays, message: 'mc mirror failed.', errorDetail: err.message, triggeredBy, startedAt, completedAt: new Date() });
    logger.error('BackupScheduler: mc mirror failed', { error: err.message });
    return { success: false, error: err.message };
  }
}

// ─── List Available Backup Files ──────────────────────────────────────────────

/**
 * Returns sorted list of available .dump files from BACKUP_DIR (newest first).
 * Used by the restore API to enumerate restorable backups.
 */
function listAvailableBackups() {
  if (!BACKUP_DIR) return [];
  try {
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.dump'))
      .map(f => {
        const full = path.join(BACKUP_DIR, f);
        const stat = fs.statSync(full);
        return { filename: f, path: full, sizeBytes: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

// ─── Scheduler Control ────────────────────────────────────────────────────────

async function scheduleOne(type) {
  try {
    const configRes = await db.query(
      `SELECT * FROM backup_scheduler_config WHERE backup_type = $1`,
      [type]
    );
    const config = configRes.rows[0];
    if (!config || !config.enabled) {
      logger.info(`BackupScheduler: ${type} backup disabled — skipping`);
      return;
    }

    const nextRun  = nextDailyRun(config.cron_expression);
    const delayMs  = Math.max(0, nextRun.getTime() - Date.now());

    await db.query(
      `UPDATE backup_scheduler_config SET next_run_at = $1, updated_at = now() WHERE backup_type = $2`,
      [nextRun, type]
    );

    logger.info(`BackupScheduler: ${type} backup scheduled`, {
      nextRun: nextRun.toISOString(),
      delayMinutes: Math.round(delayMs / 60000),
    });

    timers[type] = setTimeout(async () => {
      let runner;
      if (type === 'database') runner = runDatabaseBackup;
      else if (type === 'storage') runner = runStorageBackup;
      else if (type === 'notification_job') runner = runNotificationJob;
      else if (type === 'push_retry_job') runner = runPushRetryJob;
      else if (type === 'cleanup_job') runner = runCleanupJob;

      const result = await runner({ retentionDays: config.retention_days });
      const nextRunAfter = nextDailyRun(config.cron_expression);
      await updateConfig({ type, status: result.success ? 'success' : 'failure', nextRunAt: nextRunAfter, retentionDays: config.retention_days });
      scheduleOne(type);
    }, delayMs);
  } catch (err) {
    logger.error(`BackupScheduler: failed to schedule ${type} backup`, { error: err.message });
  }
}

function start() {
  setTimeout(() => {
    scheduleOne('database');
    scheduleOne('storage');
    scheduleOne('notification_job');
    scheduleOne('push_retry_job');
    scheduleOne('cleanup_job');
  }, 5000);
  logger.info('BackupScheduler: initialized');
}

function stop() {
  Object.keys(timers).forEach(key => { clearTimeout(timers[key]); delete timers[key]; });
  logger.info('BackupScheduler: stopped');
}

module.exports = {
  start,
  stop,
  runDatabaseBackup,
  runStorageBackup,
  runNotificationJob,
  runPushRetryJob,
  runCleanupJob,
  listAvailableBackups,
};
