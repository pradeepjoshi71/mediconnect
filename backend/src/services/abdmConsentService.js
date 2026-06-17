'use strict';

/**
 * abdmConsentService.js
 * Business logic for ABDM Consent Management.
 *
 * All operations are:
 *   - Multi-tenant safe (every query scoped to user.hospitalId)
 *   - Permission-guarded via existing RBAC
 *   - Audit-logged via auditService
 *   - Non-destructive (append-only history)
 */

const abdmConsentRepository = require('../repositories/abdmConsentRepository');
const patientRepository     = require('../repositories/patientRepository');
const auditService          = require('./auditService');
const { AppError }          = require('../utils/http');
const { hasPermission }     = require('../utils/rbac');

// ─── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Verify patient exists within the requester's tenant.
 * Throws 404 to prevent cross-tenant enumeration.
 */
async function assertPatientExists(hospitalId, patientId) {
  const patient = await patientRepository.findPatientById(patientId, hospitalId);
  if (!patient) throw new AppError(404, 'Patient not found');
  return patient;
}

/**
 * Derive a human-readable summary for the audit log.
 */
function consentSummary(consentType, action) {
  const label = {
    data_access:         'Data Access',
    health_record_share: 'Health Record Share',
    telemedicine:        'Telemedicine',
    research:            'Research Use',
    emergency_access:    'Emergency Access',
    general:             'General ABDM',
  }[consentType] || consentType;
  return `${label} consent ${action}`;
}

// ─── Service Functions ─────────────────────────────────────────────────────────

/**
 * List all consent records for a patient (full history + active summary).
 *
 * Returns:
 *   { consents: ConsentRow[], activeSummary: Record<string, ConsentRow|null> }
 *
 * activeSummary is a map of consent_type → current active record (or null).
 * This lets the UI render a quick-glance status per consent type without
 * requiring the caller to filter the history array.
 *
 * @param {object} user
 * @param {number} patientId
 * @param {object} context
 */
async function getConsents(user, patientId, context) {
  if (!hasPermission(user, 'abdm.consent.read')) {
    throw new AppError(403, 'You do not have permission to view consent records');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const consents = await abdmConsentRepository.listConsentsByPatient(user.hospitalId, patientId);

  // Build per-type active summary from the fetched history (no extra DB round-trips)
  const CONSENT_TYPES = [
    'data_access', 'health_record_share', 'telemedicine',
    'research', 'emergency_access', 'general',
  ];
  const activeSummary = {};
  for (const type of CONSENT_TYPES) {
    activeSummary[type] = consents.find(
      (c) => c.consentType === type && c.isActive
    ) || null;
  }

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.consent.read',
    entityType: 'abdm_consent',
    entityId:   patientId,
    metadata:   { totalRecords: consents.length },
    context,
  });

  return { consents, activeSummary };
}

/**
 * Record a new patient consent grant.
 *
 * Prevents duplicate active grants of the same type for the same patient —
 * the caller must revoke an existing active consent before re-granting.
 *
 * @param {object} user
 * @param {{ patient_id: number, consent_type: string, expires_at?: string, metadata?: object }} data
 * @param {object} context
 */
async function grantConsent(user, data, context) {
  if (!hasPermission(user, 'abdm.consent.grant')) {
    throw new AppError(403, 'You do not have permission to grant consent');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  // Duplicate active consent guard
  const existing = await abdmConsentRepository.findActiveConsent(
    user.hospitalId,
    data.patient_id,
    data.consent_type
  );
  if (existing) {
    throw new AppError(
      409,
      `An active ${data.consent_type} consent already exists for this patient. Revoke it before re-granting.`
    );
  }

  const consent = await abdmConsentRepository.createConsentGrant(
    user.hospitalId,
    data.patient_id,
    data
  );

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.consent.grant',
    entityType: 'abdm_consent',
    entityId:   data.patient_id,
    newValue:   { consentId: consent.id, consentType: consent.consentType, expiresAt: consent.expiresAt },
    metadata:   { summary: consentSummary(data.consent_type, 'granted') },
    context,
  });

  return { consent };
}

/**
 * Revoke an active consent record by consent ID.
 *
 * @param {object} user
 * @param {{ consent_id: number, patient_id: number }} data
 * @param {object} context
 */
async function revokeConsent(user, data, context) {
  if (!hasPermission(user, 'abdm.consent.revoke')) {
    throw new AppError(403, 'You do not have permission to revoke consent');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  // Verify the consent record belongs to this tenant
  const existing = await abdmConsentRepository.findConsentById(user.hospitalId, data.consent_id);
  if (!existing) {
    throw new AppError(404, 'Consent record not found');
  }
  if (Number(existing.patientId) !== Number(data.patient_id)) {
    throw new AppError(403, 'Consent record does not belong to this patient');
  }
  if (existing.status !== 'granted') {
    throw new AppError(409, `Cannot revoke a consent that is already '${existing.status}'`);
  }

  const revoked = await abdmConsentRepository.revokeConsent(user.hospitalId, data.consent_id);
  if (!revoked) {
    throw new AppError(409, 'Consent could not be revoked — it may have already been modified');
  }

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.consent.revoke',
    entityType: 'abdm_consent',
    entityId:   data.patient_id,
    oldValue:   { consentId: existing.id, consentType: existing.consentType, status: 'granted' },
    newValue:   { consentId: revoked.id,  consentType: revoked.consentType,  status: 'revoked', revokedAt: revoked.revokedAt },
    metadata:   { summary: consentSummary(existing.consentType, 'revoked') },
    context,
  });

  return { consent: revoked };
}

module.exports = {
  getConsents,
  grantConsent,
  revokeConsent,
};
