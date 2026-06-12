import api from "./apiClient";

export async function listItems(filters = {}) {
  const response = await api.get("/inventory/items", { params: filters });
  return response.data;
}

export async function createItem(data) {
  const response = await api.post("/inventory/items", data);
  return response.data;
}

export async function getItem(id) {
  const response = await api.get(`/inventory/items/${id}`);
  return response.data;
}

export async function updateItem(id, data) {
  const response = await api.put(`/inventory/items/${id}`, data);
  return response.data;
}

export async function deleteItem(id) {
  const response = await api.delete(`/inventory/items/${id}`);
  return response.data;
}

export async function createTransaction(data) {
  const response = await api.post("/inventory/transactions", data);
  return response.data;
}

export async function getReports() {
  const response = await api.get("/inventory/reports");
  return response.data;
}
