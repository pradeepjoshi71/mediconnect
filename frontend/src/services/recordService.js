import api from "./apiClient";

export async function getMedicalHistory(patientId) {
  const response = await api.get(`/records/${patientId}`);
  return response.data;
}

export async function createMedicalRecord(data) {
  const response = await api.post("/records", data);
  return response.data;
}

export async function updateMedicalRecord(id, data) {
  const response = await api.put(`/records/${id}`, data);
  return response.data;
}
