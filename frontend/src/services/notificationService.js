import api from "./apiClient";

export async function listNotifications() {
  const res = await api.get("/notifications");
  return res.data;
}

export async function markNotificationRead(id) {
  const res = await api.post(`/notifications/${id}/read`);
  return res.data;
}

