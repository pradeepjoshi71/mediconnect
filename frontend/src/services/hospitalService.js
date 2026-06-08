import apiClient from './apiClient';

const hospitalService = {
  async listHospitals() {
    const response = await apiClient.get('/hospitals');
    return response.data;
  },

  async getHospital(id) {
    const response = await apiClient.get(`/hospitals/${id}`);
    return response.data;
  },

  async getDepartments(hospitalId) {
    const response = await apiClient.get(`/hospitals/${hospitalId}/departments`);
    return response.data;
  },

  async createDepartment(hospitalId, data) {
    const response = await apiClient.post(`/hospitals/${hospitalId}/departments`, data);
    return response.data;
  },

  async getAuditLogs(params = {}) {
    const response = await apiClient.get('/hospitals/audit/logs', { params });
    return response.data;
  },

  async registerHospital(data) {
    const response = await apiClient.post('/hospitals/register', data);
    return response.data;
  },

  async getApplications(search = '') {
    const response = await apiClient.get('/hospitals/applications', { params: { search } });
    return response.data;
  },

  async approveApplication(id) {
    const response = await apiClient.post(`/hospitals/applications/${id}/approve`);
    return response.data;
  },

  async rejectApplication(id) {
    const response = await apiClient.post(`/hospitals/applications/${id}/reject`);
    return response.data;
  },

  async getApplicationStats() {
    const response = await apiClient.get('/hospitals/applications/stats');
    return response.data;
  },
};

export default hospitalService;
