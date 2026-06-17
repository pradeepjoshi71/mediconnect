'use strict';

/**
 * abdmCareContextRepository.js
 * Raw SQL data access for abdm_care_contexts.
 *
 * Care contexts follow an append-safe model:
 *   - Link: INSERT a new row
 *   - Unlink: UPDATE status = 'unlinked' (never DELETE)
 */

const db = require('../config/db');

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapContextRow(row) {
  if (!row) return null;
  return {
    id:                   row.id,
    tenantId:             row.tenant_id,
    patientId:            row.patient_id,
    abhaId:               row.abha_id || null,
    careContextReference: row.care_context_reference,
    displayName:          row.display_name,
    status:               row.status,
    linkedAt:             row.linked_at,
    createdAt:            row.created_at,
    updatedAt:            row.updated_at,
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * List all care contexts for a patient (all statuses, newest first).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<object[]>}
 */
async function listCareContextsByPatient(tenantId, patientId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, abha_id,
            care_context_reference, display_name, status,
            linked_at, created_at, updated_at
     FROM abdm_care_contexts
     WHERE tenant_id = $1 AND patient_id = $2
     ORDER BY created_at DESC`,
    [tenantId, patientId]
  );
  return result.rows.map(mapContextRow);
}

/**
 * Find a single care context by its ID (tenant-scoped).
 *
 * @param {number} tenantId
 * @param {number} contextId
 * @returns {Promise<object|null>}
 */
async function findContextById(tenantId, contextId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, abha_id,
            care_context_reference, display_name, status,
            linked_at, created_at, updated_at
     FROM abdm_care_contexts
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, contextId]
  );
  return mapContextRow(result.rows[0] || null);
}

/**
 * Check whether a care_context_reference already exists in a tenant.
 * Used to enforce the unique-per-tenant constraint at the service layer
 * (in addition to the DB-level UNIQUE constraint).
 *
 * @param {number} tenantId
 * @param {string} reference
 * @returns {Promise<boolean>}
 */
async function referenceExistsInTenant(tenantId, reference) {
  const result = await db.query(
    `SELECT 1 FROM abdm_care_contexts
     WHERE tenant_id = $1 AND care_context_reference = $2
     LIMIT 1`,
    [tenantId, reference]
  );
  return result.rowCount > 0;
}

/**
 * Create a new care context record (link).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ care_context_reference: string, display_name: string, abha_id?: number }} data
 * @returns {Promise<object>}
 */
async function createCareContext(tenantId, patientId, data) {
  const result = await db.query(
    `INSERT INTO abdm_care_contexts
       (tenant_id, patient_id, abha_id, care_context_reference, display_name, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING *`,
    [
      tenantId,
      patientId,
      data.abha_id || null,
      data.care_context_reference.trim(),
      data.display_name.trim(),
    ]
  );
  return mapContextRow(result.rows[0]);
}

/**
 * Unlink a care context (set status = 'unlinked').
 * Only transitions from 'active' → 'unlinked'.
 * Returns null if the row was not found or not in an active state.
 *
 * @param {number} tenantId
 * @param {number} contextId
 * @returns {Promise<object|null>}
 */
async function unlinkCareContext(tenantId, contextId) {
  const result = await db.query(
    `UPDATE abdm_care_contexts
     SET status     = 'unlinked',
         updated_at = now()
     WHERE tenant_id = $1
       AND id        = $2
       AND status    = 'active'
     RETURNING *`,
    [tenantId, contextId]
  );
  return mapContextRow(result.rows[0] || null);
}

module.exports = {
  listCareContextsByPatient,
  findContextById,
  referenceExistsInTenant,
  createCareContext,
  unlinkCareContext,
};
