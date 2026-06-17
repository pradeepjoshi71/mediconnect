import api from "./apiClient";

// ─── ABDM Consent API ─────────────────────────────────────────────────────────

/**
 * Fetch full consent history + active-per-type summary for a patient.
 * Returns: { consents: [], activeSummary: { data_access: {...}|null, ... } }
 */
export async function getPatientConsents(patientId) {
  const response = await api.get(`/abdm/consent/${patientId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Grant a new consent for a patient.
 * @param {{ patient_id, consent_type, expires_at?, metadata? }} data
 */
export async function grantConsent(data) {
  const response = await api.post("/abdm/consent/grant", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Revoke an active consent.
 * @param {{ consent_id, patient_id }} data
 */
export async function revokeConsent(data) {
  const response = await api.post("/abdm/consent/revoke", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}
