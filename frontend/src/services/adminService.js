import api from "./apiClient";

export async function listUsers() {
  const res = await api.get("/admin/users");
  return res.data;
}

export async function listAllAppointments() {
  const res = await api.get("/admin/appointments");
  return res.data;
}

export async function createDoctor(payload) {
  const res = await api.post("/admin/doctors", payload);
  return res.data;
}

