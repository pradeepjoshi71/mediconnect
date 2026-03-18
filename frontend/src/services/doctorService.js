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
