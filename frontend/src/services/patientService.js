import api from "./apiClient";

export async function listPatients(search = "") {
  const response = await api.get("/patients", {
    params: { search },
    baseURL: "/api",
  });
  return response.data;
}

export async function getPatientSummary(patientId) {
  const response = await api.get(`/patients/${patientId}`, {
    baseURL: "/api",
  });
  return response.data;
}

export async function createPatient(data) {
  const response = await api.post("/patients", data, {
    baseURL: "/api",
  });
  return response.data;
}

export async function updatePatient(id, data) {
  const response = await api.put(`/patients/${id}`, data, {
    baseURL: "/api",
  });
  return response.data;
}

// ─── ABHA Integration ──────────────────────────────────────────────────────

export async function getAbhaDetails(patientId) {
  const response = await api.get(`/abha/${patientId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

export async function linkAbha(patientId, data) {
  const response = await api.post(`/abha/${patientId}/link`, data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

export async function verifyAbha(patientId, data) {
  const response = await api.put(`/abha/${patientId}/verify`, data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

export async function unlinkAbha(patientId) {
  const response = await api.delete(`/abha/${patientId}/unlink`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

