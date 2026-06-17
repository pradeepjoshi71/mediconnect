import api from "./apiClient";

// ─── PM-JAY Claim API ─────────────────────────────────────────────────────────

/**
 * Fetch a single claim by ID.
 * Returns: { claim: {...} }
 */
export async function getClaimById(claimId) {
  const response = await api.get(`/pmjay/claims/${claimId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * List all claims for a patient.
 * Returns: { claims: [...] }
 */
export async function getClaimsByPatient(patientId) {
  const response = await api.get(`/pmjay/claims/patient/${patientId}`, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Draft a new PM-JAY claim.
 * @param {{ patient_id, claim_amount, appointment_id?, invoice_id? }} data
 */
export async function createClaim(data) {
  const response = await api.post("/pmjay/claims/create", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}

/**
 * Submit a DRAFT claim.
 * @param {number} claimId
 */
export async function submitClaim(claimId) {
  const response = await api.post(
    "/pmjay/claims/submit",
    { claim_id: claimId },
    { baseURL: "/api/v1" }
  );
  return response.data;
}

/**
 * Update claim status (admin/billing lifecycle).
 * @param {{ claim_id, status, rejection_reason? }} data
 */
export async function updateClaimStatus(data) {
  const response = await api.post("/pmjay/claims/update-status", data, {
    baseURL: "/api/v1",
  });
  return response.data;
}
