import api from "./apiClient";

export async function listPatients(search = "") {
  const response = await api.get("/patients", {
    params: { search },
  });
  return response.data;
}

export async function getPatientSummary(patientId) {
  const response = await api.get(`/patients/${patientId}`);
  return response.data;
}
