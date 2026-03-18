import api from "./apiClient";

export async function listAppointments(params = {}) {
  const response = await api.get("/appointments", { params });
  return response.data;
}

export async function bookAppointment(payload) {
  const response = await api.post("/appointments", payload);
  return response.data;
}

export async function getQueue(params = {}) {
  const response = await api.get("/appointments/queue", { params });
  return response.data;
}

export async function rescheduleAppointment(id, payload) {
  const response = await api.patch(`/appointments/${id}/reschedule`, payload);
  return response.data;
}

export async function updateAppointmentStatus(id, payload) {
  const response = await api.patch(`/appointments/${id}/status`, payload);
  return response.data;
}

export async function createWaitlist(payload) {
  const response = await api.post("/appointments/waitlist", payload);
  return response.data;
}

export async function listWaitlist() {
  const response = await api.get("/appointments/waitlist");
  return response.data;
}
