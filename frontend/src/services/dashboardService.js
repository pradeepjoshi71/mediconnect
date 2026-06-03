import api from "./apiClient";

export async function getDashboard() {
  const response = await api.get("/dashboard");
  return response.data;
}

export async function getAdminDashboard() {
  const response = await api.get("/admin/dashboard");
  return response.data;
}
