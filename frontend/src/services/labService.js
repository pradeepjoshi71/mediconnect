import api from "./apiClient";

export async function listLabTests() {
  const response = await api.get("/lab-tests", { baseURL: "/api" });
  return response.data;
}

export async function createLabTest(data) {
  const response = await api.post("/lab-tests", data, { baseURL: "/api" });
  return response.data;
}

export async function listLabOrders(filters = {}) {
  const response = await api.get("/lab-orders", { params: filters, baseURL: "/api" });
  return response.data;
}

export async function createLabOrder(data) {
  const response = await api.post("/lab-orders", data, { baseURL: "/api" });
  return response.data;
}

export async function updateLabOrderStatus(id, status) {
  const response = await api.patch(`/lab-orders/${id}/status`, { status }, { baseURL: "/api" });
  return response.data;
}

export async function createLabReport(data) {
  const response = await api.post("/lab-reports", data, { baseURL: "/api" });
  return response.data;
}

export async function listLabReports(patientId = "") {
  const path = patientId ? `/lab-reports/${patientId}` : "/lab-reports";
  const response = await api.get(path, { baseURL: "/api" });
  return response.data;
}

export async function getRevenueReports() {
  const response = await api.get("/lab-orders/revenue", { baseURL: "/api" });
  return response.data;
}

export async function downloadLabReport(id, fileName) {
  const response = await api.get(`/lab-reports/download/${id}`, {
    responseType: "blob",
    baseURL: "/api"
  });
  const url = window.URL.createObjectURL(response.data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
