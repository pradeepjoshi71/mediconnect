'use strict';

/**
 * fieldCrypto.js — Repository-layer AES-256-GCM field-level encryption.
 *
 * Designed for raw pg (no ORM). Works by wrapping plain data objects
 * before INSERT/UPDATE and unwrapping result rows after SELECT.
 *
 * Usage:
 *   encryptFields(data, ['phone', 'aadhaar_number'])  → new object with encrypted values
 *   decryptFields(row,  ['phone', 'aadhaar_number'])  → new object with decrypted values
 *   decryptRows(rows,   ['phone', 'aadhaar_number'])  → array of decrypted rows
 */

const { encryptData, decryptData } = require('./crypto');

// ─── Sensitive field registry ─────────────────────────────────────────────────
// Centralised declaration of which columns are encrypted in each entity.
// Update this map as new PHI fields are added — no other file needs changing.

const PATIENT_PII_FIELDS = [
  'phone',                    // users.phone
  'emergency_contact_phone',  // patients.emergency_contact_phone
  'address',                  // patients.address
  'insurance_member_id',      // patients.insurance_member_id
  'insurance_policy_number',  // patients.insurance_policy_number
];

const MEDICAL_RECORD_PHI_FIELDS = [
  'chief_complaint',  // medical_records.chief_complaint
  'clinical_notes',   // medical_records.clinical_notes
  'doctor_notes',     // medical_records.doctor_notes
  'diagnosis',        // medical_records.diagnosis
  'lab_summary',      // medical_records.lab_summary
];

// ─── Core helpers ─────────────────────────────────────────────────────────────

/**
 * Returns a shallow copy of `data` with the listed fields encrypted.
 * Non-string values are JSON-serialised before encryption.
 * Null/undefined values are left untouched.
 *
 * @param {Object} data
 * @param {string[]} fields
 * @returns {Object}
 */
function encryptFields(data, fields) {
  if (!data || typeof data !== 'object') return data;

  const result = { ...data };

  for (const field of fields) {
    if (result[field] === null || result[field] === undefined) continue;

    const value =
      typeof result[field] === 'object'
        ? JSON.stringify(result[field])
        : String(result[field]);

    result[field] = encryptData(value);
  }

  return result;
}

/**
 * Returns a shallow copy of a single DB row with the listed fields decrypted.
 * Values that do not look like an encrypted payload (iv:tag:cipher) are
 * returned as-is, making the function safe to call on already-plain rows
 * (e.g. during a gradual migration).
 *
 * @param {Object} row
 * @param {string[]} fields
 * @returns {Object}
 */
function decryptFields(row, fields) {
  if (!row || typeof row !== 'object') return row;

  const result = { ...row };

  for (const field of fields) {
    const value = result[field];
    if (value === null || value === undefined) continue;

    // Guard: only attempt decryption on recognisable ciphertext format
    if (typeof value === 'string' && isEncrypted(value)) {
      try {
        result[field] = decryptData(value);
      } catch {
        // Corrupt / tampered ciphertext — surface the error clearly in logs
        // but do not leak raw ciphertext to the API consumer.
        console.error(`[fieldCrypto] decryptFields: failed to decrypt field "${field}". Possible tampering or wrong key.`);
        result[field] = null;
      }
    }
  }

  return result;
}

/**
 * Convenience wrapper — decrypts an array of rows.
 *
 * @param {Object[]} rows
 * @param {string[]} fields
 * @returns {Object[]}
 */
function decryptRows(rows, fields) {
  return rows.map((row) => decryptFields(row, fields));
}

/**
 * Detects whether a string looks like our hex-encoded iv:tag:cipher format.
 * This allows safe mixed reads from databases that have both plain and
 * encrypted values (e.g. during a phased migration rollout).
 *
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  // iv (24 hex) : authTag (32 hex) : ciphertext (any length hex)
  return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
}

// ─── CamelCase aliases ────────────────────────────────────────────────────────
// Our repository SELECT queries alias columns to camelCase (e.g. "phone" stays
// "phone", but "emergency_contact_phone" is aliased to "emergencyContactPhone").
// This map lets callers use the camelCase keys returned by the DB query,
// keeping it consistent with the rest of the codebase.

const PATIENT_PII_FIELDS_CAMEL = [
  'phone',
  'emergencyContactPhone',
  'address',
  'insuranceMemberId',
  'insurancePolicyNumber',
];

const MEDICAL_RECORD_PHI_FIELDS_CAMEL = [
  'chiefComplaint',
  'clinicalNotes',
  'doctorNotes',
  'diagnosis',
  'labSummary',
];

module.exports = {
  // Core
  encryptFields,
  decryptFields,
  decryptRows,
  isEncrypted,

  // Snake_case field lists (for INSERT/UPDATE params)
  PATIENT_PII_FIELDS,
  MEDICAL_RECORD_PHI_FIELDS,

  // CamelCase field lists (for SELECT result rows)
  PATIENT_PII_FIELDS_CAMEL,
  MEDICAL_RECORD_PHI_FIELDS_CAMEL,
};
