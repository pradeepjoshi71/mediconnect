'use strict';

/**
 * abhaService.js
 * Business logic for ABHA (Ayushman Bharat Health Account) integration.
 *
 * All operations are:
 *   - Multi-tenant safe (every query is scoped to user.hospitalId)
 *   - Permission-guarded via the existing RBAC system
 *   - Audit-logged via auditService
 *   - Backward-compatible (no changes to existing patient workflows)
 */

const abhaRepository = require('../repositories/abhaRepository');
const patientRepository = require('../repositories/patientRepository');
const auditService = require('./auditService');
const { AppError } = require('../utils/http');
const { hasPermission } = require('../utils/rbac');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the patient exists within the requester's tenant.
 * Throws 404 if not found, preventing cross-tenant enumeration.
 */
async function assertPatientExists(hospitalId, patientId) {
  const patient = await patientRepository.findPatientById(patientId, hospitalId);
  if (!patient) {
    throw new AppError(404, 'Patient not found');
  }
  return patient;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Get ABHA details for a patient.
 * Returns null in the `abha` key when no ABHA record exists — callers
 * must treat null as "not yet linked" (not an error).
 *
 * Accessible by: doctor, patient_manager, hospital_admin, super_admin, admin
 *
 * @param {object} user  - req.user
 * @param {number} patientId
 * @param {object} context - req.auditContext
 */
async function getAbha(user, patientId, context) {
  if (!hasPermission(user, 'abha.read')) {
    throw new AppError(403, 'You do not have permission to view ABHA details');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const abha = await abhaRepository.findAbhaByPatientId(user.hospitalId, patientId);

  await auditService.recordAuditEvent({
    user,
    action: 'abha.read',
    entityType: 'abha',
    entityId: patientId,
    metadata: { linked: !!abha },
    context,
  });

  return { abha }; // null when not linked — that is the correct, expected state
}

/**
 * Link a new ABHA number to a patient.
 * Enforces:
 *   - Patient must exist in caller's tenant
 *   - Patient must not already have an ABHA record
 *   - ABHA number must not already be used in the tenant
 *
 * Accessible by: patient_manager, hospital_admin, super_admin, admin
 *
 * @param {object} user
 * @param {number} patientId
 * @param {{ abha_number: string, abha_address?: string }} data
 * @param {object} context
 */
async function linkAbha(user, patientId, data, context) {
  if (!hasPermission(user, 'abha.link')) {
    throw new AppError(403, 'You do not have permission to link an ABHA number');
  }

  await assertPatientExists(user.hospitalId, patientId);

  // Guard: already linked
  const existing = await abhaRepository.findAbhaByPatientId(user.hospitalId, patientId);
  if (existing) {
    throw new AppError(
      409,
      'This patient already has an ABHA number linked. Unlink the existing record before re-linking.'
    );
  }

  // Guard: duplicate ABHA number in tenant
  const isDuplicate = await abhaRepository.abhaNumberExistsInTenant(
    user.hospitalId,
    data.abha_number
  );
  if (isDuplicate) {
    throw new AppError(409, 'This ABHA number is already linked to another patient in this hospital');
  }

  const abha = await abhaRepository.createAbha(user.hospitalId, patientId, data);

  await auditService.recordAuditEvent({
    user,
    action: 'abha.link',
    entityType: 'abha',
    entityId: patientId,
    newValue: { abhaNumberMasked: abha.abhaNumberMasked, abhaAddress: abha.abhaAddress },
    metadata: { abhaNumberMasked: abha.abhaNumberMasked },
    context,
  });

  return { abha };
}

/**
 * Update the verification status of a linked ABHA record.
 * Allowed transitions: pending → verified | failed; verified → failed; etc.
 *
 * In Phase 1 this is a manual toggle — Phase 2 will hook real ABDM OTP verification here.
 *
 * Accessible by: patient_manager, hospital_admin, super_admin, admin
 *
 * @param {object} user
 * @param {number} patientId
 * @param {{ verification_status: string, verified_at?: string }} data
 * @param {object} context
 */
async function verifyAbha(user, patientId, data, context) {
  if (!hasPermission(user, 'abha.verify')) {
    throw new AppError(403, 'You do not have permission to verify ABHA records');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const existing = await abhaRepository.findAbhaByPatientId(user.hospitalId, patientId);
  if (!existing) {
    throw new AppError(404, 'No ABHA record found for this patient. Link an ABHA number first.');
  }

  if (existing.verificationStatus === 'unlinked') {
    throw new AppError(409, 'This ABHA record has been unlinked and cannot be updated');
  }

  const oldStatus = existing.verificationStatus;
  const abha = await abhaRepository.updateAbhaVerification(user.hospitalId, patientId, data);

  await auditService.recordAuditEvent({
    user,
    action: 'abha.verify',
    entityType: 'abha',
    entityId: patientId,
    oldValue: { verificationStatus: oldStatus },
    newValue: { verificationStatus: abha.verificationStatus, verifiedAt: abha.verifiedAt },
    context,
  });

  return { abha };
}

/**
 * Unlink (hard-delete) the ABHA record from a patient.
 * The operation is irreversible — the patient_manager can re-link afterwards.
 * Accessible by: hospital_admin, super_admin, admin only.
 *
 * @param {object} user
 * @param {number} patientId
 * @param {object} context
 */
async function unlinkAbha(user, patientId, context) {
  if (!hasPermission(user, 'abha.unlink')) {
    throw new AppError(403, 'You do not have permission to unlink ABHA records');
  }

  await assertPatientExists(user.hospitalId, patientId);

  const existing = await abhaRepository.findAbhaByPatientId(user.hospitalId, patientId);
  if (!existing) {
    throw new AppError(404, 'No ABHA record found for this patient');
  }

  await abhaRepository.deleteAbha(user.hospitalId, patientId);

  await auditService.recordAuditEvent({
    user,
    action: 'abha.unlink',
    entityType: 'abha',
    entityId: patientId,
    oldValue: {
      abhaNumberMasked: existing.abhaNumberMasked,
      verificationStatus: existing.verificationStatus,
    },
    context,
  });

  return { message: 'ABHA record successfully unlinked' };
}

module.exports = {
  getAbha,
  linkAbha,
  verifyAbha,
  unlinkAbha,
};
