/**
 * backupController.js
 *
 * Handles all backup-related HTTP endpoints for the super_admin panel:
 *   GET  /api/v1/system/backup/status     — WAL archiver + MinIO status
 *   GET  /api/v1/system/backup/logs       — paginated backup log history
 *   GET  /api/v1/system/backup/scheduler  — scheduler config + next run times
 *   POST /api/v1/system/backup/run        — manually trigger a backup
 *   PATCH /api/v1/system/backup/scheduler — update retention / enable flag
 *   POST /api/v1/system/backup/restore    — validate + return restore workflow
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

// ─── POST /api/v1/system/backup/restore ──────────────────────────────────────

/**
 * Returns a validated restore workflow and restore command for the DBA.
 *
 * SAFE MODE: Does NOT auto-execute pg_restore or mc mirror.
 * Auto-restoring while the app is live risks data corruption.
 * The returned command must be run in a maintenance window.
 *
 * Body: { type: "database" | "storage", backupFile?: string }
 */
async function restoreBackup(req, res, next) {
  try {
    const { type, backupFile } = req.body;

    if (!type || !['database', 'storage'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be "database" or "storage"',
      });
    }

    const backupDir  = process.env.BACKUP_DIR || '';
    const dbHost     = process.env.DB_HOST     || 'localhost';
    const dbPort     = process.env.DB_PORT     || '5432';
    const dbUser     = process.env.DB_USER     || 'postgres';
    const dbName     = process.env.DB_NAME     || 'mediconnect';
    const primaryAlias = process.env.MINIO_PRIMARY_ALIAS || 'mediconnect-primary';
    const backupAlias  = process.env.MINIO_BACKUP_ALIAS  || 'mediconnect-backup';

    let workflow;
    let availableBackups = [];
    let selectedFile = null;

    if (type === 'database') {
      // List available dump files
      availableBackups = backupScheduler.listAvailableBackups();

      if (!backupDir) {
        return res.status(400).json({
          success: false,
          message: 'BACKUP_DIR is not configured. Database restore requires a real backup directory.',
          hint: 'Set BACKUP_DIR environment variable in production.',
        });
      }

      if (availableBackups.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No backup files found in BACKUP_DIR. Trigger a backup first.',
          backupDir,
        });
      }

      // Use specified file or latest
      selectedFile = backupFile
        ? availableBackups.find(b => b.filename === backupFile)
        : availableBackups[0];

      if (!selectedFile) {
        return res.status(404).json({
          success: false,
          message: `Backup file not found: ${backupFile}`,
          available: availableBackups.map(b => b.filename),
        });
      }

      workflow = {
        type: 'database',
        backupFile: selectedFile.filename,
        backupPath: selectedFile.path,
        backupSize: `${(selectedFile.sizeBytes / 1024 / 1024).toFixed(2)} MB`,
        backupCreatedAt: selectedFile.createdAt,
        requiresDowntime: true,
        steps: [
          '1. Schedule a maintenance window (application must be stopped).',
          '2. Stop the application: docker-compose stop backend  OR  pm2 stop mediconnect-api',
          `3. Run: PGPASSWORD=$DB_PASSWORD pg_restore --clean --if-exists -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} ${selectedFile.path}`,
          '4. Verify restore: psql -c "SELECT COUNT(*) FROM users" mediconnect',
          '5. Restart the application: docker-compose start backend  OR  pm2 restart mediconnect-api',
          '6. Verify application health: GET /api/v1/health/ready',
        ],
        restoreCommand: `PGPASSWORD=$DB_PASSWORD pg_restore --clean --if-exists -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} ${selectedFile.path}`,
        verifyCommand: `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "SELECT COUNT(*) FROM users, patients, doctors"`,
      };
    } else {
      // Storage restore via mc mirror (reverse direction)
      if (!backupAlias) {
        return res.status(400).json({
          success: false,
          message: 'MINIO_BACKUP_ALIAS is not configured. Storage restore requires MinIO backup instance.',
          hint: 'Set MINIO_BACKUP_ALIAS and MINIO_PRIMARY_ALIAS in production.',
        });
      }

      workflow = {
        type: 'storage',
        requiresDowntime: false,
        steps: [
          `1. Verify backup MinIO is accessible: mc ls ${backupAlias}/`,
          `2. Mirror from backup back to primary: mc mirror --overwrite ${backupAlias}/ ${primaryAlias}/`,
          '3. Verify bucket contents: mc ls mediconnect-primary/ --recursive | head -20',
          '4. Application file access should resume automatically (no restart needed).',
        ],
        restoreCommand: `mc mirror --overwrite ${backupAlias}/ ${primaryAlias}/`,
        verifyCommand:  `mc ls ${primaryAlias}/ --recursive --json | wc -l`,
      };
    }

    // Log the restore request (audit trail)
    try {
      await db.query(
        `INSERT INTO backup_logs
           (backup_type, status, retention_days, message, triggered_by, started_at, completed_at)
         VALUES ($1, 'info', 7, $2, 'restore_request', now(), now())`,
        [
          type,
          `Restore workflow requested by user ${req.user?.id} (${req.user?.email}). File: ${selectedFile?.filename || 'N/A'}.`,
        ]
      );
    } catch (logErr) {
      logger.warn('backupController: could not write restore audit log', { error: logErr.message });
    }

    logger.info('BackupController: restore workflow returned', { type, userId: req.user?.id, file: selectedFile?.filename });

    res.json({
      success: true,
      message: 'Restore workflow prepared. Review steps carefully before executing.',
      availableBackups: type === 'database' ? availableBackups.map(b => ({
        filename: b.filename,
        sizeBytes: b.sizeBytes,
        createdAt: b.createdAt,
      })) : [],
      workflow,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getBackupLogs,
  getSchedulerConfig,
  triggerManualBackup,
  updateSchedulerConfig,
  restoreBackup,
};
