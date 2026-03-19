import api from "./apiClient";

export async function listUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function createStaff(payload) {
  const response = await api.post("/admin/staff", payload);
  return response.data;
}

export async function getHospitalSummary() {
  const response = await api.get("/admin/hospital");
  return response.data;
}

export async function listAuditLogs(params = {}) {
  const response = await api.get("/admin/audit-logs", { params });
  return response.data;
}
