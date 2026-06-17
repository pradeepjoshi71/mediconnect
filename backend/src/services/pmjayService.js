'use strict';

/**
 * pmjayService.js
 * Business logic for PM-JAY Beneficiary Eligibility.
 *
 * All operations are:
 *   - Multi-tenant safe (scoped to user.hospitalId)
 *   - Permission-guarded via existing RBAC
 *   - Audit-logged via auditService
 *   - Backward-compatible (optional enrollment, existing patients unaffected)
 */

const pmjayRepository   = require('../repositories/pmjayRepository');
const patientRepository = require('../repositories/patientRepository');
const auditService      = require('./auditService');
const { AppError }      = require('../utils/http');
const { hasPermission } = require('../utils/rbac');

// ─── Internal Helper ──────────────────────────────────────────────────────────

async function assertPatientExists(hospitalId, patientId) {
  const patient = await patientRepository.findPatientById(patientId, hospitalId);
  if (!patient) throw new AppError(404, 'Patient not found');
  return patient;
}

// ─── Service Functions ─────────────────────────────────────────────────────────

/**
 * Get PM-JAY details for a patient.
 * Returns null in the `pmjay` field if not enrolled.
 */
async function getPmjayDetails(user, patientId, context) {
  if (!hasPermission(user, 'pmjay.read')) {
    throw new AppError(403, 'You do not have permission to view PM-JAY details');
  }

  await assertPatientExists(user.hospitalId, patientId);
  const pmjay = await pmjayRepository.findByPatient(user.hospitalId, patientId);

  await auditService.recordAuditEvent({
    user,
    action:     'pmjay.read',
    entityType: 'pmjay_beneficiary',
    entityId:   patientId,
    metadata:   { linked: !!pmjay },
    context,
  });

  return { pmjay };
}

/**
 * Link a PM-JAY enrollment to a patient.
 * Prevents:
 *   - Duplicate enrollment for the same patient
 *   - The same pmjay_id being used for two patients in one tenant
 */
async function linkPmjay(user, data, context) {
  if (!hasPermission(user, 'pmjay.link')) {
    throw new AppError(403, 'You do not have permission to link PM-JAY');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  // Duplicate patient guard
  const existing = await pmjayRepository.findByPatient(user.hospitalId, data.patient_id);
  if (existing) {
    throw new AppError(409, `Patient already has a PM-JAY ID linked: ${existing.pmjayId}`);
  }

  // Duplicate pmjay_id guard
  const idExists = await pmjayRepository.pmjayIdExistsInTenant(
    user.hospitalId,
    data.pmjay_id
  );
  if (idExists) {
    throw new AppError(409, `PM-JAY ID ${data.pmjay_id} is already linked to another patient in this hospital`);
  }

  const pmjay = await pmjayRepository.createBeneficiary(user.hospitalId, data.patient_id, data);

  await auditService.recordAuditEvent({
    user,
    action:     'pmjay.link',
    entityType: 'pmjay_beneficiary',
    entityId:   data.patient_id,
    newValue:   { pmjayId: pmjay.pmjayId, beneficiaryName: pmjay.beneficiaryName },
    context,
  });

  return { pmjay };
}

/**
 * Mark a PM-JAY enrollment as staff-verified (or failed).
 * Optionally update eligibility_status at the same time.
 */
async function verifyPmjay(user, data, context) {
  if (!hasPermission(user, 'pmjay.verify')) {
    throw new AppError(403, 'You do not have permission to verify PM-JAY');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);

  const existing = await pmjayRepository.findByPatient(user.hospitalId, data.patient_id);
  if (!existing) throw new AppError(404, 'No PM-JAY enrollment found for this patient');

  const updated = await pmjayRepository.updateBeneficiaryStatus(user.hospitalId, data.patient_id, {
    verification_status: data.verification_status,
    eligibility_status:  data.eligibility_status || undefined,
  });

  await auditService.recordAuditEvent({
    user,
    action:     'pmjay.verify',
    entityType: 'pmjay_beneficiary',
    entityId:   data.patient_id,
    oldValue:   { verificationStatus: existing.verificationStatus, eligibilityStatus: existing.eligibilityStatus },
    newValue:   { verificationStatus: updated.verificationStatus, eligibilityStatus: updated.eligibilityStatus },
    context,
  });

  return { pmjay: updated };
}

/**
 * Unlink (hard-delete) a PM-JAY enrollment.
 * Audit event written BEFORE deletion to capture the old state.
 */
async function unlinkPmjay(user, patientId, context) {
  if (!hasPermission(user, 'pmjay.unlink')) {
    throw new AppError(403, 'You do not have permission to unlink PM-JAY');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const existing = await pmjayRepository.findByPatient(user.hospitalId, patientId);
  if (!existing) throw new AppError(404, 'No PM-JAY enrollment found for this patient');

  // Audit before delete (preserve old state)
  await auditService.recordAuditEvent({
    user,
    action:     'pmjay.unlink',
    entityType: 'pmjay_beneficiary',
    entityId:   patientId,
    oldValue:   { pmjayId: existing.pmjayId, beneficiaryName: existing.beneficiaryName, eligibilityStatus: existing.eligibilityStatus },
    context,
  });

  await pmjayRepository.deleteBeneficiary(user.hospitalId, patientId);
  return { success: true };
}

module.exports = {
  getPmjayDetails,
  linkPmjay,
  verifyPmjay,
  unlinkPmjay,
};
