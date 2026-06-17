'use strict';

/**
 * pmjayRepository.js
 * Raw SQL data access for pmjay_beneficiaries.
 *
 * One-to-one with patient per tenant.
 * Unlink is a hard DELETE (row removed); audit trail is preserved via auditService.
 */

const db = require('../config/db');

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapBeneficiaryRow(row) {
  if (!row) return null;
  return {
    id:                 row.id,
    tenantId:           row.tenant_id,
    patientId:          row.patient_id,
    pmjayId:            row.pmjay_id,
    beneficiaryName:    row.beneficiary_name,
    eligibilityStatus:  row.eligibility_status,
    verificationStatus: row.verification_status,
    verifiedAt:         row.verified_at || null,
    metadata:           row.metadata || {},
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Find a patient's PM-JAY enrollment (returns null if not linked).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<object|null>}
 */
async function findByPatient(tenantId, patientId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, pmjay_id, beneficiary_name,
            eligibility_status, verification_status, verified_at,
            metadata, created_at, updated_at
     FROM pmjay_beneficiaries
     WHERE tenant_id = $1 AND patient_id = $2
     LIMIT 1`,
    [tenantId, patientId]
  );
  return mapBeneficiaryRow(result.rows[0] || null);
}

/**
 * Check whether a pmjay_id is already linked in this tenant.
 *
 * @param {number} tenantId
 * @param {string} pmjayId
 * @returns {Promise<boolean>}
 */
async function pmjayIdExistsInTenant(tenantId, pmjayId) {
  const result = await db.query(
    `SELECT 1 FROM pmjay_beneficiaries
     WHERE tenant_id = $1 AND pmjay_id = $2
     LIMIT 1`,
    [tenantId, pmjayId]
  );
  return result.rowCount > 0;
}

/**
 * Link a PM-JAY enrollment for a patient.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ pmjay_id: string, beneficiary_name: string }} data
 * @returns {Promise<object>}
 */
async function createBeneficiary(tenantId, patientId, data) {
  const result = await db.query(
    `INSERT INTO pmjay_beneficiaries
       (tenant_id, patient_id, pmjay_id, beneficiary_name,
        eligibility_status, verification_status)
     VALUES ($1, $2, $3, $4, 'pending', 'pending')
     RETURNING *`,
    [tenantId, patientId, data.pmjay_id.trim().toUpperCase(), data.beneficiary_name.trim()]
  );
  return mapBeneficiaryRow(result.rows[0]);
}

/**
 * Update eligibility and/or verification status.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ eligibility_status?: string, verification_status?: string }} fields
 * @returns {Promise<object|null>}
 */
async function updateBeneficiaryStatus(tenantId, patientId, fields) {
  const setVerifiedAt = fields.verification_status === 'verified' ? ', verified_at = now()' : '';
  const result = await db.query(
    `UPDATE pmjay_beneficiaries
     SET eligibility_status  = COALESCE($3, eligibility_status),
         verification_status = COALESCE($4, verification_status),
         updated_at          = now()
         ${setVerifiedAt}
     WHERE tenant_id = $1 AND patient_id = $2
     RETURNING *`,
    [
      tenantId,
      patientId,
      fields.eligibility_status  || null,
      fields.verification_status || null,
    ]
  );
  return mapBeneficiaryRow(result.rows[0] || null);
}

/**
 * Remove a PM-JAY enrollment (hard delete).
 * Audit trail is captured by the service layer before calling this.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<boolean>} true if a row was deleted
 */
async function deleteBeneficiary(tenantId, patientId) {
  const result = await db.query(
    `DELETE FROM pmjay_beneficiaries
     WHERE tenant_id = $1 AND patient_id = $2
     RETURNING id`,
    [tenantId, patientId]
  );
  return result.rowCount > 0;
}

module.exports = {
  findByPatient,
  pmjayIdExistsInTenant,
  createBeneficiary,
  updateBeneficiaryStatus,
  deleteBeneficiary,
};
