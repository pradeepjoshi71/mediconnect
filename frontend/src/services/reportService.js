import api from "./apiClient";

export async function listReports() {
  const res = await api.get("/reports");
  return res.data;
}

export async function listReportsForAppointment(appointmentId) {
  const res = await api.get("/reports", { params: { appointmentId } });
  return res.data;
}

export async function uploadReport({ file, patientId, doctorId, appointmentId }) {
  const fd = new FormData();
  fd.append("file", file);
  if (patientId) fd.append("patientId", String(patientId));
  if (doctorId) fd.append("doctorId", String(doctorId));
  if (appointmentId) fd.append("appointmentId", String(appointmentId));

  const res = await api.post("/reports/upload", fd, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export function reportDownloadUrl(id) {
  return `/api/v1/reports/${id}/download`;
}

