import api from "./apiClient";

// ─── PM-JAY Beneficiary API ───────────────────────────────────────────────────

/**
 * Fetch PM-JAY details for a patient.
 * Returns: { pmjay: {...} | null }
 */
export async function getPmjayDetails(patientId) {
  const response = await api.get(`/pmjay/${patientId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Link a PM-JAY enrollment.
 * @param {{ patient_id, pmjay_id, beneficiary_name }} data
 */
export async function linkPmjay(data) {
  const response = await api.post("/pmjay/link", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Verify or fail a PM-JAY enrollment.
 * @param {{ patient_id, verification_status, eligibility_status? }} data
 */
export async function verifyPmjay(data) {
  const response = await api.post("/pmjay/verify", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Unlink (remove) a PM-JAY enrollment.
 * @param {number} patientId
 */
export async function unlinkPmjay(patientId) {
  const response = await api.delete("/pmjay/unlink", {
    baseURL: "/api/v1",
    data: { patient_id: patientId },
  });
  return response.data;
}
