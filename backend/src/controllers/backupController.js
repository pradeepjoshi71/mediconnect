/**
 * backupController.js
 *
 * Handles all backup-related HTTP endpoints for the super_admin panel:
 *   GET  /api/v1/system/backup/status     (existing — unchanged)
 *   GET  /api/v1/system/backup/logs       NEW — paginated backup log history
 *   GET  /api/v1/system/backup/scheduler  NEW — scheduler config + next run times
 *   POST /api/v1/system/backup/run        NEW — manually trigger a backup
 *   PATCH /api/v1/system/backup/scheduler NEW — update retention / enable flag
 */

const db = require('../config/db');
const minioService = require('../services/minioService');
const backupScheduler = require('../services/backupScheduler');
const logger = require('../utils/logger');

// ─── GET /api/v1/system/backup/logs ──────────────────────────────────────────

async function getBackupLogs(req, res, next) {
  try {
    const limit  = Math.min(parseInt(req.query.limit,  10) || 50, 200);
    const offset = parseInt(req.query.offset, 10) || 0;
    const type   = req.query.type; // 'database' | 'storage' | undefined

    const conditions = [];
    const params = [];

    if (type && ['database', 'storage'].includes(type)) {
      params.push(type);
      conditions.push(`backup_type = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [rowsRes, countRes] = await Promise.all([
      db.query(
        `SELECT id, backup_type, status, duration_ms, size_bytes, retention_days,
                message, error_detail, triggered_by, started_at, completed_at
         FROM backup_logs
         ${where}
         ORDER BY started_at DESC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      ),
      db.query(`SELECT COUNT(*) AS total FROM backup_logs ${where}`, params),
    ]);

    res.json({
      success: true,
      total: parseInt(countRes.rows[0].total, 10),
      limit,
      offset,
      logs: rowsRes.rows,
    });
  } catch (err) {
    next(err);
  }
}

// ─── GET /api/v1/system/backup/scheduler ──────────────────────────────────────

async function getSchedulerConfig(req, res, next) {
  try {
    const result = await db.query(
      `SELECT backup_type, enabled, cron_expression, retention_days,
              last_run_at, last_run_status, next_run_at, failed_count,
              success_count, updated_at
       FROM backup_scheduler_config
       ORDER BY backup_type`
    );

    // Compute a summary stat: last success + consecutive failures per type
    const summaryRes = await db.query(
      `SELECT backup_type,
              MAX(CASE WHEN status = 'success' THEN started_at END) AS last_success_at,
              COUNT(CASE WHEN status = 'failure' AND started_at > now() - interval '7 days' THEN 1 END) AS recent_failures
       FROM backup_logs
       GROUP BY backup_type`
    );

    const summaryMap = {};
    for (const row of summaryRes.rows) {
      summaryMap[row.backup_type] = {
        lastSuccessAt: row.last_success_at,
        recentFailures: parseInt(row.recent_failures, 10),
      };
    }

    const enriched = result.rows.map((row) => ({
      ...row,
      ...(summaryMap[row.backup_type] || {}),
    }));

    res.json({ success: true, schedulers: enriched });
  } catch (err) {
    next(err);
  }
}

// ─── POST /api/v1/system/backup/run ───────────────────────────────────────────

async function triggerManualBackup(req, res, next) {
  try {
    const { type } = req.body;

    if (!type || !['database', 'storage'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "database" or "storage"' });
    }

    logger.info('BackupController: manual backup triggered', { type, userId: req.user?.id });

    // Run asynchronously — respond immediately, result written to backup_logs
    const runner = type === 'database'
      ? backupScheduler.runDatabaseBackup
      : backupScheduler.runStorageBackup;

    // Kick off without awaiting so the HTTP response is instant
    runner({ triggeredBy: 'manual' }).then(async (result) => {
      await db.query(
        `UPDATE backup_scheduler_config
         SET last_run_at     = now(),
             last_run_status = $1,
             ${result.success ? 'success_count' : 'failed_count'} = ${result.success ? 'success_count' : 'failed_count'} + 1,
             updated_at      = now()
         WHERE backup_type = $2`,
        [result.success ? 'success' : 'failure', type]
      );
    }).catch((err) => {
      logger.error('BackupController: manual backup async error', { error: err.message });
    });

    res.status(202).json({
      success: true,
      message: `${type} backup triggered. Results will appear in backup logs shortly.`,
    });
  } catch (err) {
    next(err);
  }
}

// ─── PATCH /api/v1/system/backup/scheduler ────────────────────────────────────

async function updateSchedulerConfig(req, res, next) {
  try {
    const { type, enabled, retention_days } = req.body;

    if (!type || !['database', 'storage'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type must be "database" or "storage"' });
    }

    const updates = [];
    const params = [];

    if (typeof enabled === 'boolean') {
      params.push(enabled);
      updates.push(`enabled = $${params.length}`);
    }

    if (retention_days && [7, 14, 30, 60, 90].includes(Number(retention_days))) {
      params.push(Number(retention_days));
      updates.push(`retention_days = $${params.length}`);
    }

    if (!updates.length) {
      return res.status(400).json({ success: false, message: 'No valid fields to update. Allowed: enabled, retention_days (7/14/30/60/90).' });
    }

    params.push(type);
    updates.push(`updated_at = now()`);

    await db.query(
      `UPDATE backup_scheduler_config SET ${updates.join(', ')} WHERE backup_type = $${params.length}`,
      params
    );

    const updated = await db.query(
      `SELECT * FROM backup_scheduler_config WHERE backup_type = $1`,
      [type]
    );

    res.json({ success: true, scheduler: updated.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBackupLogs,
  getSchedulerConfig,
  triggerManualBackup,
  updateSchedulerConfig,
};
