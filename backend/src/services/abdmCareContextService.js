'use strict';

/**
 * abdmCareContextService.js
 * Business logic for ABDM Care Context Linking.
 *
 * All operations are:
 *   - Multi-tenant safe (scoped to user.hospitalId)
 *   - Permission-guarded via existing RBAC
 *   - Audit-logged via auditService
 *   - Backward-compatible (append-safe, no deletes)
 */

const abdmCareContextRepository = require('../repositories/abdmCareContextRepository');
const patientRepository          = require('../repositories/patientRepository');
const auditService               = require('./auditService');
const { AppError }               = require('../utils/http');
const { hasPermission }          = require('../utils/rbac');

// ─── Internal Helper ──────────────────────────────────────────────────────────

async function assertPatientExists(hospitalId, patientId) {
  const patient = await patientRepository.findPatientById(patientId, hospitalId);
  if (!patient) throw new AppError(404, 'Patient not found');
  return patient;
}

// ─── Service Functions ─────────────────────────────────────────────────────────

/**
 * List all care contexts for a patient.
 * Returns the full history (active + unlinked).
 *
 * @param {object} user
 * @param {number} patientId
 * @param {object} context
 */
async function getCareContexts(user, patientId, context) {
  if (!hasPermission(user, 'abdm.carecontext.read')) {
    throw new AppError(403, 'You do not have permission to view care contexts');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const careContexts = await abdmCareContextRepository.listCareContextsByPatient(
    user.hospitalId,
    patientId
  );

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.carecontext.read',
    entityType: 'abdm_care_context',
    entityId:   patientId,
    metadata:   { totalContexts: careContexts.length },
    context,
  });

  return {
    careContexts,
    activeCount: careContexts.filter((c) => c.status === 'active').length,
  };
}

/**
 * Link a new care context to a patient.
 * Enforces:
 *   - Patient must exist in caller's tenant
 *   - care_context_reference must be unique in the tenant
 *
 * @param {object} user
 * @param {{ patient_id, care_context_reference, display_name, abha_id? }} data
 * @param {object} context
 */
async function linkCareContext(user, data, context) {
  if (!hasPermission(user, 'abdm.carecontext.link')) {
    throw new AppError(403, 'You do not have permission to link care contexts');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  // Duplicate reference guard (also enforced by DB UNIQUE constraint)
  const exists = await abdmCareContextRepository.referenceExistsInTenant(
    user.hospitalId,
    data.care_context_reference
  );
  if (exists) {
    throw new AppError(
      409,
      `A care context with reference "${data.care_context_reference}" already exists in this hospital`
    );
  }

  const careContext = await abdmCareContextRepository.createCareContext(
    user.hospitalId,
    data.patient_id,
    data
  );

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.carecontext.link',
    entityType: 'abdm_care_context',
    entityId:   data.patient_id,
    newValue:   {
      contextId:            careContext.id,
      careContextReference: careContext.careContextReference,
      displayName:          careContext.displayName,
    },
    context,
  });

  return { careContext };
}

/**
 * Unlink (soft-deactivate) a care context.
 * Sets status = 'unlinked'; the record is preserved for audit history.
 *
 * @param {object} user
 * @param {{ context_id: number, patient_id: number }} data
 * @param {object} context
 */
async function unlinkCareContext(user, data, context) {
  if (!hasPermission(user, 'abdm.carecontext.unlink')) {
    throw new AppError(403, 'You do not have permission to unlink care contexts');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  // Verify the context belongs to this tenant
  const existing = await abdmCareContextRepository.findContextById(
    user.hospitalId,
    data.context_id
  );
  if (!existing) throw new AppError(404, 'Care context not found');

  if (Number(existing.patientId) !== Number(data.patient_id)) {
    throw new AppError(403, 'Care context does not belong to this patient');
  }
  if (existing.status !== 'active') {
    throw new AppError(409, `Cannot unlink a context that is already '${existing.status}'`);
  }

  const unlinked = await abdmCareContextRepository.unlinkCareContext(
    user.hospitalId,
    data.context_id
  );
  if (!unlinked) {
    throw new AppError(409, 'Care context could not be unlinked — it may have already been modified');
  }

  await auditService.recordAuditEvent({
    user,
    action:     'abdm.carecontext.unlink',
    entityType: 'abdm_care_context',
    entityId:   data.patient_id,
    oldValue:   { contextId: existing.id, careContextReference: existing.careContextReference, status: 'active' },
    newValue:   { contextId: unlinked.id, status: 'unlinked' },
    context,
  });

  return { careContext: unlinked };
}

module.exports = { getCareContexts, linkCareContext, unlinkCareContext };
