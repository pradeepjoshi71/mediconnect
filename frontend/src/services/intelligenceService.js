import api from "./apiClient";

export async function runSymptomCheck(payload) {
  const response = await api.post("/intelligence/symptom-check", payload);
  return response.data;
}

export async function getDoctorRecommendations(params = {}) {
  const response = await api.get("/intelligence/doctor-recommendations", { params });
  return response.data;
}

export async function getFollowUpReminders() {
  const response = await api.get("/intelligence/follow-ups");
  return response.data;
}

export async function getPredictiveInsights() {
  const response = await api.get("/intelligence/predictive-insights");
  return response.data;
}
