import api from "./apiClient";

export async function getMedicalHistory(patientId) {
  const response = await api.get(`/medical-records/${patientId}`, {
    baseURL: "/api",
  });
  return response.data;
}

export async function createMedicalRecord(data) {
  const response = await api.post("/medical-records", data, {
    baseURL: "/api",
  });
  return response.data;
}

export async function updateMedicalRecord(id, data) {
  const response = await api.put(`/medical-records/${id}`, data, {
    baseURL: "/api",
  });
  return response.data;
}
