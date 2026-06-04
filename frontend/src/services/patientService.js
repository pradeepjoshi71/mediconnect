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
