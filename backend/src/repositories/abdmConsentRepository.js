'use strict';

/**
 * abdmConsentRepository.js
 * Raw SQL data access for abdm_consents.
 *
 * Consent records are append-only by design — grant and revoke
 * each create a new row. This gives a complete, tamper-evident
 * history that mirrors ABDM's own audit requirements.
 */

const db = require('../config/db');

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function mapConsentRow(row) {
  if (!row) return null;
  return {
    id:          row.id,
    tenantId:    row.tenant_id,
    patientId:   row.patient_id,
    consentType: row.consent_type,
    status:      row.status,
    grantedAt:   row.granted_at  || null,
    revokedAt:   row.revoked_at  || null,
    expiresAt:   row.expires_at  || null,
    metadata:    row.metadata    || {},
    createdAt:   row.created_at,
    updatedAt:   row.updated_at,
    // Computed helper: is this consent currently active?
    isActive:    row.status === 'granted' && (!row.expires_at || new Date(row.expires_at) > new Date()),
  };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * List all consent records for a patient (full history, newest first).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<object[]>}
 */
async function listConsentsByPatient(tenantId, patientId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, consent_type, status,
            granted_at, revoked_at, expires_at, metadata, created_at, updated_at
     FROM abdm_consents
     WHERE tenant_id = $1 AND patient_id = $2
     ORDER BY created_at DESC`,
    [tenantId, patientId]
  );
  return result.rows.map(mapConsentRow);
}

/**
 * Find the most recent active (granted, not expired) consent of a given type
 * for a patient. Returns null if none exists.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {string} consentType
 * @returns {Promise<object|null>}
 */
async function findActiveConsent(tenantId, patientId, consentType) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, consent_type, status,
            granted_at, revoked_at, expires_at, metadata, created_at, updated_at
     FROM abdm_consents
     WHERE tenant_id   = $1
       AND patient_id  = $2
       AND consent_type = $3
       AND status      = 'granted'
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, patientId, consentType]
  );
  return mapConsentRow(result.rows[0] || null);
}

/**
 * Find a consent record by its ID (tenant-scoped).
 *
 * @param {number} tenantId
 * @param {number} consentId
 * @returns {Promise<object|null>}
 */
async function findConsentById(tenantId, consentId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, consent_type, status,
            granted_at, revoked_at, expires_at, metadata, created_at, updated_at
     FROM abdm_consents
     WHERE tenant_id = $1 AND id = $2
     LIMIT 1`,
    [tenantId, consentId]
  );
  return mapConsentRow(result.rows[0] || null);
}

/**
 * Create a new consent grant record.
 * A new row is always inserted; previous consents of the same type are
 * not modified (history is preserved).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ consent_type: string, expires_at?: string, metadata?: object }} data
 * @returns {Promise<object>}
 */
async function createConsentGrant(tenantId, patientId, data) {
  const result = await db.query(
    `INSERT INTO abdm_consents
       (tenant_id, patient_id, consent_type, status, granted_at, expires_at, metadata)
     VALUES ($1, $2, $3, 'granted', now(), $4, $5)
     RETURNING *`,
    [
      tenantId,
      patientId,
      data.consent_type,
      data.expires_at ? new Date(data.expires_at) : null,
      data.metadata ? JSON.stringify(data.metadata) : '{}',
    ]
  );
  return mapConsentRow(result.rows[0]);
}

/**
 * Revoke an existing consent grant by ID.
 * Sets status = 'revoked' and stamps revoked_at.
 * Only affects rows that are currently 'granted'.
 *
 * @param {number} tenantId
 * @param {number} consentId
 * @returns {Promise<object|null>} updated row or null if not found / not revokable
 */
async function revokeConsent(tenantId, consentId) {
  const result = await db.query(
    `UPDATE abdm_consents
     SET status     = 'revoked',
         revoked_at = now(),
         updated_at = now()
     WHERE tenant_id = $1
       AND id        = $2
       AND status    = 'granted'
     RETURNING *`,
    [tenantId, consentId]
  );
  return mapConsentRow(result.rows[0] || null);
}

module.exports = {
  listConsentsByPatient,
  findActiveConsent,
  findConsentById,
  createConsentGrant,
  revokeConsent,
};
