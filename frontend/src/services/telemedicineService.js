import api from "./apiClient";

export async function getTelemedicineSession(appointmentId) {
  const response = await api.get(`/telemedicine/appointments/${appointmentId}/session`);
  return response.data;
}

export async function listTelemedicineMessages(appointmentId) {
  const response = await api.get(`/telemedicine/appointments/${appointmentId}/messages`);
  return response.data;
}

export async function sendTelemedicineMessage(appointmentId, body) {
  const response = await api.post(`/telemedicine/appointments/${appointmentId}/messages`, {
    body,
  });
  return response.data;
}
