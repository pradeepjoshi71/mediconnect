'use strict';

/**
 * pmjayClaimRepository.js
 * Raw SQL data access for pmjay_claims.
 *
 * Key design decisions:
 *   - claim_number is generated server-side: PMJAY-YYYYMMDD-NNNNN (date + 5-digit seq)
 *   - Status transitions are enforced at service layer (not DB trigger)
 *   - Hard delete is NOT supported (claims are immutable audit records)
 */

const db = require('../config/db');

// ─── Claim Number Generator ───────────────────────────────────────────────────

/**
 * Generate a unique claim number: PMJAY-YYYYMMDD-NNNNN
 * Uses a count of today's existing claims to determine the sequence.
 *
 * @param {object} client — DB client (used inside transaction or standalone)
 * @param {number} tenantId
 * @returns {Promise<string>}
 */
async function generateClaimNumber(tenantId) {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');

  const result = await db.query(
    `SELECT COUNT(*)::int AS today_count
     FROM pmjay_claims
     WHERE tenant_id = $1
       AND claim_number LIKE $2`,
    [tenantId, `PMJAY-${datePart}-%`]
  );

  const seq = String((result.rows[0]?.today_count ?? 0) + 1).padStart(5, '0');
  return `PMJAY-${datePart}-${seq}`;
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapClaimRow(row) {
  if (!row) return null;
  return {
    id:              row.id,
    tenantId:        row.tenant_id,
    patientId:       row.patient_id,
    beneficiaryId:   row.beneficiary_id,
    appointmentId:   row.appointment_id   || null,
    invoiceId:       row.invoice_id       || null,
    claimNumber:     row.claim_number,
    claimAmount:     parseFloat(row.claim_amount),
    status:          row.status,
    submittedAt:     row.submitted_at     || null,
    approvedAt:      row.approved_at      || null,
    paidAt:          row.paid_at          || null,
    rejectionReason: row.rejection_reason || null,
    metadata:        row.metadata         || {},
    createdAt:       row.created_at,
    updatedAt:       row.updated_at,
    // Optional joined fields
    pmjayId:         row.pmjay_id         || undefined,
    beneficiaryName: row.beneficiary_name || undefined,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Find a single claim by ID (with beneficiary info joined).
 */
async function findClaimById(id, tenantId) {
  const result = await db.query(
    `SELECT c.*,
            b.pmjay_id, b.beneficiary_name
     FROM pmjay_claims c
     JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
     WHERE c.id = $1 AND c.tenant_id = $2
     LIMIT 1`,
    [id, tenantId]
  );
  return mapClaimRow(result.rows[0] || null);
}

/**
 * List all claims for a patient, most recent first.
 */
async function listClaimsByPatient(tenantId, patientId) {
  const result = await db.query(
    `SELECT c.*,
            b.pmjay_id, b.beneficiary_name
     FROM pmjay_claims c
     JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
     WHERE c.tenant_id = $1 AND c.patient_id = $2
     ORDER BY c.created_at DESC`,
    [tenantId, patientId]
  );
  return result.rows.map(mapClaimRow);
}

/**
 * Check for an existing open claim for the same appointment (duplicate guard).
 */
async function findActiveClaimByAppointment(tenantId, patientId, appointmentId) {
  const result = await db.query(
    `SELECT id FROM pmjay_claims
     WHERE tenant_id = $1
       AND patient_id = $2
       AND appointment_id = $3
       AND status NOT IN ('REJECTED')
     LIMIT 1`,
    [tenantId, patientId, appointmentId]
  );
  return result.rows[0] || null;
}

/**
 * Create a new claim in DRAFT status.
 */
async function createClaim(tenantId, data) {
  const claimNumber = await generateClaimNumber(tenantId);

  const result = await db.query(
    `INSERT INTO pmjay_claims
       (tenant_id, patient_id, beneficiary_id, appointment_id, invoice_id,
        claim_number, claim_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'DRAFT')
     RETURNING *`,
    [
      tenantId,
      data.patient_id,
      data.beneficiary_id,
      data.appointment_id || null,
      data.invoice_id     || null,
      claimNumber,
      data.claim_amount,
    ]
  );
  return mapClaimRow(result.rows[0]);
}

/**
 * Submit a DRAFT claim (status → SUBMITTED).
 */
async function submitClaim(id, tenantId) {
  const result = await db.query(
    `UPDATE pmjay_claims
     SET status       = 'SUBMITTED',
         submitted_at = now(),
         updated_at   = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'DRAFT'
     RETURNING *`,
    [id, tenantId]
  );
  return mapClaimRow(result.rows[0] || null);
}

/**
 * Update claim status (for admin lifecycle transitions).
 * Automatically sets the appropriate timestamp field.
 *
 * @param {number} id
 * @param {number} tenantId
 * @param {{ status: string, rejection_reason?: string }} fields
 */
async function updateClaimStatus(id, tenantId, fields) {
  const { status, rejection_reason } = fields;

  const setApprovedAt = status === 'APPROVED'  ? ', approved_at = now()' : '';
  const setPaidAt     = status === 'PAID'       ? ', paid_at = now()'     : '';

  const result = await db.query(
    `UPDATE pmjay_claims
     SET status           = $3,
         rejection_reason = COALESCE($4, rejection_reason),
         updated_at       = now()
         ${setApprovedAt}
         ${setPaidAt}
     WHERE id = $1 AND tenant_id = $2
     RETURNING *`,
    [id, tenantId, status, rejection_reason || null]
  );
  return mapClaimRow(result.rows[0] || null);
}

module.exports = {
  findClaimById,
  listClaimsByPatient,
  findActiveClaimByAppointment,
  createClaim,
  submitClaim,
  updateClaimStatus,
};
