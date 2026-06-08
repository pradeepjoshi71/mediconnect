const db = require('../config/db');
const { pingRedis } = require('../config/redis');
const minioService = require('../services/minioService');

/**
 * GET /api/v1/system/health
 * Returns live health status of API, DB, Storage (MinIO), and Queue (Redis).
 * super_admin only.
 */
async function getSystemHealth(req, res, next) {
  try {
    const startTime = Date.now();

    // ─── Database ────────────────────────────────────────────────────────────
    let database = { status: 'error', latencyMs: null };
    try {
      const t0 = Date.now();
      await db.query('SELECT 1');
      database = { status: 'healthy', latencyMs: Date.now() - t0 };
    } catch (err) {
      database = { status: 'error', latencyMs: null, error: err.message };
    }

    // ─── Queue / Redis ────────────────────────────────────────────────────────
    let queue = { status: 'unknown', latencyMs: null };
    try {
      const t0 = Date.now();
      const result = await pingRedis();
      queue = {
        status: result.status === 'ready' ? 'healthy' : result.status === 'disabled' ? 'disabled' : 'degraded',
        latencyMs: Date.now() - t0,
        enabled: result.enabled,
      };
    } catch (err) {
      queue = { status: 'error', error: err.message };
    }

    // ─── Storage / MinIO ──────────────────────────────────────────────────────
    let storage = { status: 'unknown', latencyMs: null };
    try {
      const t0 = Date.now();
      const ok = await minioService.healthCheck();
      storage = {
        status: ok ? 'healthy' : 'error',
        latencyMs: Date.now() - t0,
        buckets: minioService.DEFAULT_BUCKETS.length,
      };
    } catch (err) {
      storage = { status: 'error', error: err.message };
    }

    // ─── API self ─────────────────────────────────────────────────────────────
    const api = { status: 'healthy', latencyMs: Date.now() - startTime, uptime: Math.floor(process.uptime()) };

    const allHealthy = [database, queue, storage].every(
      (c) => c.status === 'healthy' || c.status === 'disabled'
    );

    res.status(allHealthy ? 200 : 207).json({
      success: true,
      overall: allHealthy ? 'healthy' : 'degraded',
      checkedAt: new Date().toISOString(),
      checks: { api, database, queue, storage },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/system/monitoring
 * Returns platform-wide monitoring metrics for the super_admin control panel.
 */
async function getMonitoringMetrics(req, res, next) {
  try {
    // Active tenants
    const tenantsRes = await db.query(
      `SELECT COUNT(*) AS count FROM hospitals WHERE status IN ('active', 'trial')`
    );
    const activeTenants = parseInt(tenantsRes.rows[0].count, 10);

    // Active users (logged-in within last 24h via session — approximate via active user count)
    const usersRes = await db.query(
      `SELECT COUNT(*) AS count FROM users WHERE status = 'active'`
    );
    const activeUsers = parseInt(usersRes.rows[0].count, 10);

    // Storage usage — total file_metadata rows and approximate sizes
    let storageUsage = { totalFiles: 0, configuredBuckets: minioService.DEFAULT_BUCKETS.length, status: 'unknown' };
    try {
      const filesRes = await db.query(
        `SELECT COUNT(*) AS count FROM file_metadata`
      );
      const ok = await minioService.healthCheck();
      storageUsage = {
        totalFiles: parseInt(filesRes.rows[0].count, 10),
        configuredBuckets: minioService.DEFAULT_BUCKETS.length,
        status: ok ? 'connected' : 'disconnected',
      };
    } catch {
      storageUsage.status = 'unavailable';
    }

    // Error count — audit_logs with error-like actions in last 24h
    let errorCount = 0;
    try {
      const errRes = await db.query(
        `SELECT COUNT(*) AS count FROM audit_logs
         WHERE created_at >= now() - interval '24 hours'
           AND action ILIKE '%error%'`
      );
      errorCount = parseInt(errRes.rows[0].count, 10);
    } catch {
      errorCount = -1; // sentinel: table may not exist or query failed
    }

    // Appointment and patient totals for quick overview
    const [apptRes, patientRes, doctorRes] = await Promise.allSettled([
      db.query(`SELECT COUNT(*) AS count FROM appointments WHERE status NOT IN ('cancelled')`),
      db.query(`SELECT COUNT(*) AS count FROM patients`),
      db.query(`SELECT COUNT(*) AS count FROM doctors WHERE is_active = true`),
    ]);

    const totalAppointments = apptRes.status === 'fulfilled' ? parseInt(apptRes.value.rows[0].count, 10) : 0;
    const totalPatients = patientRes.status === 'fulfilled' ? parseInt(patientRes.value.rows[0].count, 10) : 0;
    const totalDoctors = doctorRes.status === 'fulfilled' ? parseInt(doctorRes.value.rows[0].count, 10) : 0;

    res.json({
      success: true,
      collectedAt: new Date().toISOString(),
      metrics: {
        activeTenants,
        activeUsers,
        totalPatients,
        totalDoctors,
        totalAppointments,
        storageUsage,
        errorCount,
        serverUptime: Math.floor(process.uptime()),
        nodeVersion: process.version,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/system/backup/status
 * Returns backup status for DB and MinIO.
 * Currently checks last pg_stat_archiver record and MinIO connectivity.
 * In production, wire this to your actual pg_dump cron job metadata.
 */
async function getBackupStatus(req, res, next) {
  try {
    // ─── PostgreSQL backup status via pg_stat_archiver ─────────────────────
    let dbBackup = { status: 'unknown', lastArchivedAt: null, error: null };
    try {
      const result = await db.query(
        `SELECT
           last_archived_wal,
           last_archived_time,
           last_failed_wal,
           last_failed_time,
           archived_count,
           failed_count
         FROM pg_stat_archiver`
      );
      const row = result.rows[0];
      if (row) {
        const hasRecent = row.last_archived_time &&
          (Date.now() - new Date(row.last_archived_time).getTime()) < 86400000; // within 24h
        dbBackup = {
          status: row.last_failed_wal && !row.last_archived_wal
            ? 'error'
            : hasRecent ? 'healthy' : 'stale',
          lastArchivedWal: row.last_archived_wal || null,
          lastArchivedAt: row.last_archived_time ? row.last_archived_time.toISOString() : null,
          lastFailedWal: row.last_failed_wal || null,
          lastFailedAt: row.last_failed_time ? row.last_failed_time.toISOString() : null,
          archivedCount: parseInt(row.archived_count, 10),
          failedCount: parseInt(row.failed_count, 10),
          note: 'WAL archiving via pg_stat_archiver',
        };
      } else {
        dbBackup = { status: 'not_configured', note: 'pg_stat_archiver returned no rows — WAL archiving may not be configured' };
      }
    } catch (err) {
      dbBackup = { status: 'error', error: err.message };
    }

    // ─── MinIO (object storage) backup status ─────────────────────────────
    let storageBackup = { status: 'unknown' };
    try {
      const ok = await minioService.healthCheck();
      storageBackup = {
        status: ok ? 'connected' : 'disconnected',
        configuredBuckets: minioService.DEFAULT_BUCKETS,
        note: ok
          ? 'MinIO reachable — bucket-level replication depends on MinIO server configuration'
          : 'MinIO not reachable — check MINIO_* env vars',
        restorePlaceholder: 'Use MinIO mirror or mc cp commands to restore from backup bucket',
      };
    } catch (err) {
      storageBackup = { status: 'error', error: err.message };
    }

    res.json({
      success: true,
      checkedAt: new Date().toISOString(),
      backup: {
        database: dbBackup,
        storage: storageBackup,
        restoreWorkflow: {
          database: [
            '1. Stop the application server.',
            '2. Run: pg_restore --clean -d <DB_NAME> <backup_file.dump>',
            '3. Restart the application and verify connectivity.',
          ],
          storage: [
            '1. Identify the source backup bucket (e.g., mc ls backup-minio/mediconnect-backup).',
            '2. Run: mc mirror backup-minio/mediconnect-backup minio/mediconnect-data --overwrite',
            '3. Verify bucket contents and application access.',
          ],
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getSystemHealth, getMonitoringMetrics, getBackupStatus };
