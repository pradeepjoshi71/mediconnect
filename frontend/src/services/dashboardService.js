import api from "./apiClient";

export async function getDashboard() {
  const response = await api.get("/dashboard");
  return response.data;
}
