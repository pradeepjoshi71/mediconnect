'use strict';

/**
 * abhaRepository.js
 * Raw SQL data access for patient_abha_details.
 *
 * abha_number is encrypted at rest using the same AES-256-GCM
 * field-level encryption used for other patient PII.
 */

const db = require('../config/db');
const { encryptData, decryptData } = require('../security/crypto');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encrypt abha_number before INSERT / UPDATE.
 * Only encrypts truthy string values; null/undefined pass through.
 */
function encryptAbha(value) {
  if (!value) return value;
  return encryptData(String(value).trim());
}

/**
 * Decrypt abha_number after SELECT.
 * Falls back to the raw value if it doesn't look like ciphertext
 * (safe for gradual migration or test environments).
 */
function decryptAbha(value) {
  if (!value) return value;
  // Recognisable format: 24-hex : 32-hex : any-hex
  if (/^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value)) {
    try {
      return decryptData(value);
    } catch {
      return null; // corrupted ciphertext — do not leak raw bytes
    }
  }
  return value; // plain value (test / pre-migration)
}

/**
 * Map a raw DB row to a clean camelCase response object.
 * Decrypts abha_number and masks it for display.
 */
function mapAbhaRow(row) {
  if (!row) return null;
  const plain = decryptAbha(row.abha_number);
  return {
    id:                 row.id,
    tenantId:           row.tenant_id,
    patientId:          row.patient_id,
    abhaNumber:         plain,
    abhaNumberMasked:   maskAbhaNumber(plain),
    abhaAddress:        row.abha_address || null,
    verificationStatus: row.verification_status,
    verifiedAt:         row.verified_at || null,
    createdAt:          row.created_at,
    updatedAt:          row.updated_at,
  };
}

/**
 * Mask all but the last 4 digits: "XXXXXXXXXX1234"
 */
function maskAbhaNumber(abhaNumber) {
  if (!abhaNumber) return null;
  const digits = abhaNumber.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return 'X'.repeat(digits.length - 4) + digits.slice(-4);
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Find ABHA details for a given patient in a tenant.
 * Returns null if no record exists (ABHA not yet linked).
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<object|null>}
 */
async function findAbhaByPatientId(tenantId, patientId) {
  const result = await db.query(
    `SELECT id, tenant_id, patient_id, abha_number, abha_address,
            verification_status, verified_at, created_at, updated_at
     FROM patient_abha_details
     WHERE tenant_id = $1 AND patient_id = $2
     LIMIT 1`,
    [tenantId, patientId]
  );
  return mapAbhaRow(result.rows[0] || null);
}

/**
 * Check whether an ABHA number already exists in the tenant (duplicate guard).
 * Compares against the encrypted form stored in the DB.
 *
 * Because AES-GCM is non-deterministic we must decrypt all tenant rows
 * and compare in application code. In practice a tenant will have at most
 * a few thousand ABHA records so a full scan is acceptable for Phase 1.
 * Phase 2 can add a deterministic HMAC index if needed.
 *
 * @param {number} tenantId
 * @param {string} abhaNumber - plain-text 14-digit ABHA number
 * @param {number|null} excludePatientId - patient to exclude (for future update use)
 * @returns {Promise<boolean>} true if a duplicate exists
 */
async function abhaNumberExistsInTenant(tenantId, abhaNumber, excludePatientId = null) {
  const result = await db.query(
    `SELECT id, patient_id, abha_number
     FROM patient_abha_details
     WHERE tenant_id = $1`,
    [tenantId]
  );

  const normalised = String(abhaNumber).replace(/\D/g, '');

  for (const row of result.rows) {
    if (excludePatientId && Number(row.patient_id) === Number(excludePatientId)) continue;
    const decrypted = decryptAbha(row.abha_number);
    if (decrypted && String(decrypted).replace(/\D/g, '') === normalised) {
      return true;
    }
  }
  return false;
}

/**
 * Insert a new ABHA record for a patient.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ abha_number: string, abha_address?: string }} data
 * @returns {Promise<object>} the created ABHA record
 */
async function createAbha(tenantId, patientId, data) {
  const encryptedAbha = encryptAbha(data.abha_number);

  const result = await db.query(
    `INSERT INTO patient_abha_details
       (tenant_id, patient_id, abha_number, abha_address, verification_status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [tenantId, patientId, encryptedAbha, data.abha_address || null]
  );
  return mapAbhaRow(result.rows[0]);
}

/**
 * Update verification status (and optional verified_at) on an existing ABHA record.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @param {{ verification_status: string, verified_at?: string }} data
 * @returns {Promise<object|null>}
 */
async function updateAbhaVerification(tenantId, patientId, data) {
  const result = await db.query(
    `UPDATE patient_abha_details
     SET verification_status = $1,
         verified_at         = $2,
         updated_at          = now()
     WHERE tenant_id = $3 AND patient_id = $4
     RETURNING *`,
    [
      data.verification_status,
      data.verified_at ? new Date(data.verified_at) : (data.verification_status === 'verified' ? new Date() : null),
      tenantId,
      patientId,
    ]
  );
  return mapAbhaRow(result.rows[0] || null);
}

/**
 * Hard-delete the ABHA record (unlink).
 * Returns true if a row was deleted, false if not found.
 *
 * @param {number} tenantId
 * @param {number} patientId
 * @returns {Promise<boolean>}
 */
async function deleteAbha(tenantId, patientId) {
  const result = await db.query(
    `DELETE FROM patient_abha_details
     WHERE tenant_id = $1 AND patient_id = $2`,
    [tenantId, patientId]
  );
  return result.rowCount > 0;
}

module.exports = {
  findAbhaByPatientId,
  abhaNumberExistsInTenant,
  createAbha,
  updateAbhaVerification,
  deleteAbha,
};
