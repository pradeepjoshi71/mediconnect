import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

export async function listDocuments(patientId) {
  const response = await api.get(`/documents/${patientId}`);
  return response.data;
}

export async function uploadDocument(patientId, file, documentType = "report") {
  const formData = new FormData();
  formData.append("patient_id", patientId);
  formData.append("document_type", documentType);
  formData.append("file", file);

  const response = await api.post("/documents/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
}

export async function downloadDocument(id, fileName) {
  await downloadProtectedFile(`/documents/${id}/download`, fileName);
}
