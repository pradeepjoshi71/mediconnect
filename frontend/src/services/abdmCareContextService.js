import api from "./apiClient";

// ─── ABDM Care Context API ────────────────────────────────────────────────────

/**
 * Fetch all care contexts for a patient.
 * Returns: { careContexts: [], activeCount: number }
 */
export async function getCareContexts(patientId) {
  const response = await api.get(`/abdm/care-context/${patientId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Link a new care context.
 * @param {{ patient_id, care_context_reference, display_name, abha_id? }} data
 */
export async function linkCareContext(data) {
  const response = await api.post("/abdm/care-context/link", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Unlink (soft-deactivate) a care context.
 * @param {{ context_id, patient_id }} data
 */
export async function unlinkCareContext(data) {
  const response = await api.post("/abdm/care-context/unlink", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}
