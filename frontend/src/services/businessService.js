import api from "./apiClient";

export async function getRevenueDashboard() {
  const response = await api.get("/business/revenue");
  return response.data;
}

export async function listExpenses(filters = {}) {
  const response = await api.get("/business/expenses", { params: filters });
  return response.data;
}

export async function createExpense(data) {
  const response = await api.post("/business/expenses", data);
  return response.data;
}

export async function updateExpense(id, data) {
  const response = await api.put(`/business/expenses/${id}`, data);
  return response.data;
}

export async function deleteExpense(id) {
  const response = await api.delete(`/business/expenses/${id}`);
  return response.data;
}

export async function getProfitLoss() {
  const response = await api.get("/business/profit-loss");
  return response.data;
}
