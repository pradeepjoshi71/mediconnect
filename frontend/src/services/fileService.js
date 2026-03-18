import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function listFiles(params = {}) {
  const response = await api.get("/files", { params });
  return response.data;
}

export async function uploadFile(payload) {
  const formData = new FormData();
  formData.append("file", payload.file);

  if (payload.patientId) formData.append("patientId", String(payload.patientId));
  if (payload.appointmentId) formData.append("appointmentId", String(payload.appointmentId));
  if (payload.medicalRecordId) formData.append("medicalRecordId", String(payload.medicalRecordId));
  if (payload.fileCategory) formData.append("fileCategory", payload.fileCategory);
  if (payload.accessScope) formData.append("accessScope", payload.accessScope);

  const response = await api.post("/files", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data;
}

export async function downloadFile(fileId) {
  await downloadProtectedFile(`/files/${fileId}/download`, `file-${fileId}`);
}
