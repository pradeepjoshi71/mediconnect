import api from "./apiClient";

export async function listDepartments() {
  const response = await api.get("/departments");
  return response.data;
}

export async function getDepartment(id) {
  const response = await api.get(`/departments/${id}`);
  return response.data;
}

export async function createDepartment(data) {
  const response = await api.post("/departments", data);
  return response.data;
}

export async function updateDepartment(id, data) {
  const response = await api.put(`/departments/${id}`, data);
  return response.data;
}

export async function deleteDepartment(id) {
  const response = await api.delete(`/departments/${id}`);
  return response.data;
}

export async function listDepartmentMembers(id) {
  const response = await api.get(`/departments/${id}/members`);
  return response.data;
}

export async function addDepartmentMember(id, userId) {
  const response = await api.post(`/departments/${id}/members`, { userId });
  return response.data;
}

export async function removeDepartmentMember(departmentId, userId) {
  const response = await api.delete(`/departments/${departmentId}/members/${userId}`);
  return response.data;
}

export async function getDepartmentAnalytics() {
  const response = await api.get("/departments/analytics");
  return response.data;
}
