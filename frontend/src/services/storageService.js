import apiClient from './apiClient';

const storageService = {
  /**
   * Upload a file to MinIO via the backend.
   * @param {File} file - The file to upload
   * @param {string} resourceType - 'lab_report'|'prescription'|'invoice'|'patient_document'|'profile_image'
   * @param {number|null} resourceId - Optional linked record ID
   * @param {function} onProgress - Optional progress callback (not supported with fetch, placeholder)
   */
  async uploadFile(file, resourceType = 'patient_document', resourceId = null) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('resourceType', resourceType);
    if (resourceId) formData.append('resourceId', String(resourceId));

    const response = await apiClient.post('/storage/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async getDownloadUrl(fileId) {
    const response = await apiClient.get(`/storage/files/${fileId}/url`);
    return response.data;
  },

  async listFiles(resourceType = null, resourceId = null) {
    const params = {};
    if (resourceType) params.resourceType = resourceType;
    if (resourceId)   params.resourceId   = resourceId;
    const response = await apiClient.get('/storage/files', { params });
    return response.data;
  },

  async deleteFile(fileId) {
    const response = await apiClient.delete(`/storage/files/${fileId}`);
    return response.data;
  },
};

export default storageService;
