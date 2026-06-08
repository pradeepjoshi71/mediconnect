import apiClient from './apiClient';

const subscriptionService = {
  // ─── Plans ──────────────────────────────────────────────────────────────────
  async getPlans(includeInactive = false) {
    const r = await apiClient.get('/subscriptions/plans', { params: { all: includeInactive } });
    return r.data;
  },
  async createPlan(data) {
    const r = await apiClient.post('/subscriptions/plans', data);
    return r.data;
  },
  async updatePlan(id, data) {
    const r = await apiClient.put(`/subscriptions/plans/${id}`, data);
    return r.data;
  },
  async disablePlan(id) {
    const r = await apiClient.patch(`/subscriptions/plans/${id}/disable`);
    return r.data;
  },
  async enablePlan(id) {
    const r = await apiClient.patch(`/subscriptions/plans/${id}/enable`);
    return r.data;
  },

  // ─── Subscriptions ───────────────────────────────────────────────────────────
  async getSubscriptions(status) {
    const r = await apiClient.get('/subscriptions', { params: status ? { status } : {} });
    return r.data;
  },
  async getExpiring(days = 7) {
    const r = await apiClient.get('/subscriptions/expiring', { params: { days } });
    return r.data;
  },
  async assignPlan(hospitalId, planId, notes, durationDays) {
    const r = await apiClient.post('/subscriptions/assign', { hospitalId, planId, notes, durationDays });
    return r.data;
  },

  // ─── Hospital Admin ──────────────────────────────────────────────────────────
  async getMySubscription() {
    const r = await apiClient.get('/subscriptions/my');
    return r.data;
  },
  async getMyHistory() {
    const r = await apiClient.get('/subscriptions/my/history');
    return r.data;
  },
  async requestUpgrade(message) {
    const r = await apiClient.post('/subscriptions/my/upgrade-request', { message });
    return r.data;
  },
};

export default subscriptionService;
