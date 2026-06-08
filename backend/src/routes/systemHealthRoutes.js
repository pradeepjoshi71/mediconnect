const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const roleMiddleware = require('../middlewares/roleMiddleware');
const ctrl = require('../controllers/systemHealthController');
const backupCtrl = require('../controllers/backupController');

const router = express.Router();

// Middleware shorthand for super_admin only routes
const superAdminOnly = [authMiddleware, roleMiddleware('super_admin')];

// ─── System Health ─────────────────────────────────────────────────────────────

/** GET /api/v1/system/health — Live status of API, DB, Storage, Queue. */
router.get('/health', ...superAdminOnly, ctrl.getSystemHealth);

/** GET /api/v1/system/monitoring — Platform-wide KPIs. */
router.get('/monitoring', ...superAdminOnly, ctrl.getMonitoringMetrics);

// ─── Backup — Status (Phase 5.0 compat) ───────────────────────────────────────

/** GET /api/v1/system/backup/status — WAL archiver + MinIO status. */
router.get('/backup/status', ...superAdminOnly, ctrl.getBackupStatus);

// ─── Backup — Phase 5.1 ────────────────────────────────────────────────────────

/** GET /api/v1/system/backup/logs — Paginated backup log history. */
router.get('/backup/logs', ...superAdminOnly, backupCtrl.getBackupLogs);

/** GET /api/v1/system/backup/scheduler — Scheduler config + last/next run. */
router.get('/backup/scheduler', ...superAdminOnly, backupCtrl.getSchedulerConfig);

/** POST /api/v1/system/backup/run — Trigger a manual backup immediately. */
router.post('/backup/run', ...superAdminOnly, backupCtrl.triggerManualBackup);

/** PATCH /api/v1/system/backup/scheduler — Update retention days or enable flag. */
router.patch('/backup/scheduler', ...superAdminOnly, backupCtrl.updateSchedulerConfig);

module.exports = router;
