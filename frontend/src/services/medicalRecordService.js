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
