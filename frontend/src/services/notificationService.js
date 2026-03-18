import api from "./apiClient";

export async function listNotifications() {
  const response = await api.get("/notifications");
  return response.data;
}

export async function markNotificationRead(id) {
  const response = await api.post(`/notifications/${id}/read`);
  return response.data;
}

export async function markAllNotificationsRead() {
  await api.post("/notifications/read-all");
}
