import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function listMyMedicalRecords() {
  const response = await api.get("/medical-records/mine");
  return response.data;
}

export async function listPatientMedicalHistory(patientId) {
  const response = await api.get(`/medical-records/patients/${patientId}`);
  return response.data;
}

export async function createConsultation(payload) {
  const response = await api.post("/medical-records/consultations", payload);
  return response.data;
}

export async function downloadPrescriptionPdf(recordId) {
  await downloadProtectedFile(
    `/medical-records/${recordId}/prescription-pdf`,
    `prescription-${recordId}.pdf`
  );
}

// ─── Diagnoses ────────────────────────────────────────────────────────────────

export async function listDiagnoses(patientId) {
  const response = await api.get(`/medical-records/patients/${patientId}/diagnoses`);
  return response.data;
}

export async function createDiagnosis(patientId, payload) {
  const response = await api.post(`/medical-records/patients/${patientId}/diagnoses`, payload);
  return response.data;
}

export async function updateDiagnosis(id, payload) {
  const response = await api.patch(`/medical-records/diagnoses/${id}`, payload);
  return response.data;
}

export async function deleteDiagnosis(id) {
  await api.delete(`/medical-records/diagnoses/${id}`);
}

// ─── Allergies ────────────────────────────────────────────────────────────────

export async function listAllergies(patientId) {
  const response = await api.get(`/medical-records/patients/${patientId}/allergies`);
  return response.data;
}

export async function createAllergy(patientId, payload) {
  const response = await api.post(`/medical-records/patients/${patientId}/allergies`, payload);
  return response.data;
}

export async function updateAllergy(id, payload) {
  const response = await api.patch(`/medical-records/allergies/${id}`, payload);
  return response.data;
}

export async function deleteAllergy(id) {
  await api.delete(`/medical-records/allergies/${id}`);
}

