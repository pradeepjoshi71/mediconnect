import api from "./apiClient";

export async function listDoctors(params = {}) {
  const response = await api.get("/doctors", { params });
  return response.data;
}

export async function getDoctorAvailability(doctorId, date) {
  const response = await api.get(`/doctors/${doctorId}/availability`, {
    params: { date },
  });
  return response.data;
}

export async function getMyAvailability() {
  const response = await api.get("/doctors/me/availability");
  return response.data;
}

export async function updateMyAvailability(rules) {
  await api.put("/doctors/me/availability", { rules });
}

export async function listMyTimeOff() {
  const response = await api.get("/doctors/me/time-off");
  return response.data;
}

export async function addMyTimeOff(payload) {
  const response = await api.post("/doctors/me/time-off", payload);
  return response.data;
}

export async function getDoctorById(id) {
  const response = await api.get(`/doctors/${id}`);
  return response.data;
}

export async function createDoctor(payload) {
  const response = await api.post("/doctors", payload);
  return response.data;
}

export async function updateDoctor(id, payload) {
  const response = await api.put(`/doctors/${id}`, payload);
  return response.data;
}

export async function updateDoctorStatus(id, status) {
  const response = await api.patch(`/doctors/${id}/status`, { status });
  return response.data;
}

export async function updateDoctorAvailability(id, availabilityStatus) {
  const response = await api.patch(`/doctors/${id}/availability`, {
    availability_status: availabilityStatus,
  });
  return response.data;
}
