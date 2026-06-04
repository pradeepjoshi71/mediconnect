import api from "./apiClient";

export async function getMedicines(params) {
  const response = await api.get("/medicines", { params });
  return response.data;
}

export async function createMedicine(data) {
  const response = await api.post("/medicines", data);
  return response.data;
}

export async function updateMedicine(id, data) {
  const response = await api.put(`/medicines/${id}`, data);
  return response.data;
}

export async function updateStock(id, stockQuantity) {
  const response = await api.patch(`/medicines/${id}/stock`, { stockQuantity });
  return response.data;
}

export async function getPrescriptions(params) {
  const response = await api.get("/pharmacy/prescriptions", { params });
  return response.data;
}

export async function getDispensed(params) {
  const response = await api.get("/pharmacy/dispensed", { params });
  return response.data;
}

export async function dispenseMedicine(data) {
  const response = await api.post("/pharmacy/dispense", data);
  return response.data;
}
