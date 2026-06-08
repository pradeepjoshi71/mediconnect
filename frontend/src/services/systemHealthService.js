import apiClient from './apiClient';

const systemHealthService = {
  /** GET /api/v1/system/health */
  async getHealth() {
    const res = await apiClient.get('/system/health');
    return res.data;
  },

  /** GET /api/v1/system/monitoring */
  async getMonitoring() {
    const res = await apiClient.get('/system/monitoring');
    return res.data;
  },

  /** GET /api/v1/system/backup/status */
  async getBackupStatus() {
    const res = await apiClient.get('/system/backup/status');
    return res.data;
  },

  // ─── Phase 5.1 ────────────────────────────────────────────────────────────

  /** GET /api/v1/system/backup/logs?type=database|storage&limit=50&offset=0 */
  async getBackupLogs(params = {}) {
    const res = await apiClient.get('/system/backup/logs', { params });
    return res.data;
  },

  /** GET /api/v1/system/backup/scheduler */
  async getSchedulerConfig() {
    const res = await apiClient.get('/system/backup/scheduler');
    return res.data;
  },

  /** POST /api/v1/system/backup/run — trigger manual backup */
  async triggerBackup(type) {
    const res = await apiClient.post('/system/backup/run', { type });
    return res.data;
  },

  /** PATCH /api/v1/system/backup/scheduler — update retention / enabled */
  async updateScheduler(type, patch) {
    const res = await apiClient.patch('/system/backup/scheduler', { type, ...patch });
    return res.data;
  },
};

export default systemHealthService;

