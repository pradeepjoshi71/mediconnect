import api from "./apiClient";

export async function listMyAppointments() {
  const res = await api.get("/appointments/mine");
  return res.data;
}

export async function bookAppointment(payload) {
  const res = await api.post("/appointments", payload);
  return res.data;
}

export async function cancelAppointment(id) {
  const res = await api.post(`/appointments/${id}/cancel`);
  return res.data;
}

export async function rescheduleAppointment(id, payload) {
  const res = await api.post(`/appointments/${id}/reschedule`, payload);
  return res.data;
}

export async function updateAppointmentStatus(id, status) {
  const res = await api.post(`/appointments/${id}/status`, { status });
  return res.data;
}

