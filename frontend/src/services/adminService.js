import api from "./apiClient";

export async function listUsers() {
  const response = await api.get("/admin/users");
  return response.data;
}

export async function createStaff(payload) {
  const response = await api.post("/admin/staff", payload);
  return response.data;
}
