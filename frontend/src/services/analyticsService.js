import api from "./apiClient";

export async function getAnalyticsOverview() {
  const response = await api.get("/analytics");
  return response.data;
}
