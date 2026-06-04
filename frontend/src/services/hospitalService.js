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
};

export default hospitalService;
