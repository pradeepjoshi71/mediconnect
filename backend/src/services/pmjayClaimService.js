'use strict';

/**
 * pmjayClaimService.js
 * Business logic for PM-JAY Claim Management.
 *
 * Status machine enforced here (not at DB layer):
 *   DRAFT → SUBMITTED  (via submit)
 *   SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED  (via update-status)
 *   APPROVED → PAID  (via update-status)
 *
 * Rules:
 *   - Patient must have an active pmjay_beneficiaries record
 *   - Duplicate claim for same appointment prevented (unless prior is REJECTED)
 *   - All transitions audit-logged
 *   - Multi-tenant safe (all queries scoped to user.hospitalId)
 */

const pmjayClaimRepository = require('../repositories/pmjayClaimRepository');
const pmjayRepository      = require('../repositories/pmjayRepository');
const patientRepository    = require('../repositories/patientRepository');
const auditService         = require('./auditService');
const { AppError }         = require('../utils/http');
const { hasPermission }    = require('../utils/rbac');

// ── Valid forward transitions ─────────────────────────────────────────────────
const VALID_TRANSITIONS = {
  DRAFT:        ['SUBMITTED'],
  SUBMITTED:    ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED:     ['PAID'],
  REJECTED:     [],
  PAID:         [],
};

function assertValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      422,
      `Cannot transition claim from ${currentStatus} to ${nextStatus}. ` +
      `Allowed transitions: ${allowed.join(', ') || 'none'}`
    );
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function assertPatientExists(hospitalId, patientId) {
  const patient = await patientRepository.findPatientById(patientId, hospitalId);
  if (!patient) throw new AppError(404, 'Patient not found');
  return patient;
}

async function assertBeneficiaryEnrolled(hospitalId, patientId) {
  const beneficiary = await pmjayRepository.findByPatient(hospitalId, patientId);
  if (!beneficiary) {
    throw new AppError(422, 'Patient is not enrolled in PM-JAY. Link a PM-JAY enrollment before creating a claim.');
  }
  return beneficiary;
}

// ── Service Functions ─────────────────────────────────────────────────────────

/**
 * Get a single claim by ID.
 */
async function getClaimById(user, claimId, context) {
  if (!hasPermission(user, 'pmjay.claim.read')) {
    throw new AppError(403, 'You do not have permission to view PM-JAY claims');
  }
  const claim = await pmjayClaimRepository.findClaimById(claimId, user.hospitalId);
  if (!claim) throw new AppError(404, 'PM-JAY claim not found');
  return { claim };
}

/**
 * List all claims for a patient.
 */
async function getClaimsByPatient(user, patientId, context) {
  if (!hasPermission(user, 'pmjay.claim.read')) {
    throw new AppError(403, 'You do not have permission to view PM-JAY claims');
  }
  await assertPatientExists(user.hospitalId, patientId);
  const claims = await pmjayClaimRepository.listClaimsByPatient(user.hospitalId, patientId);
  return { claims };
}

/**
 * Create a new claim in DRAFT status.
 * Validates beneficiary enrollment and prevents duplicate active claims per appointment.
 */
async function createClaim(user, data, context) {
  if (!hasPermission(user, 'pmjay.claim.create')) {
    throw new AppError(403, 'You do not have permission to create PM-JAY claims');
  }

  await assertPatientExists(user.hospitalId, data.patient_id);
  const beneficiary = await assertBeneficiaryEnrolled(user.hospitalId, data.patient_id);

  // Prevent duplicate claims for the same appointment
  if (data.appointment_id) {
    const existing = await pmjayClaimRepository.findActiveClaimByAppointment(
      user.hospitalId, data.patient_id, data.appointment_id
    );
    if (existing) {
      throw new AppError(409, `An active PM-JAY claim (ID: ${existing.id}) already exists for this appointment.`);
    }
  }

  const claim = await pmjayClaimRepository.createClaim(user.hospitalId, {
    ...data,
    beneficiary_id: beneficiary.id,
  });

  await auditService.recordAuditEvent({
    user,
    action:     'PMJAY_CLAIM_CREATED',
    entityType: 'pmjay_claim',
    entityId:   claim.id,
    newValue:   { claimNumber: claim.claimNumber, claimAmount: claim.claimAmount, patientId: data.patient_id },
    context,
  });

  return { claim };
}

/**
 * Submit a DRAFT claim (DRAFT → SUBMITTED).
 */
async function submitClaim(user, claimId, context) {
  if (!hasPermission(user, 'pmjay.claim.submit')) {
    throw new AppError(403, 'You do not have permission to submit PM-JAY claims');
  }

  const existing = await pmjayClaimRepository.findClaimById(claimId, user.hospitalId);
  if (!existing) throw new AppError(404, 'PM-JAY claim not found');
  assertValidTransition(existing.status, 'SUBMITTED');

  const claim = await pmjayClaimRepository.submitClaim(claimId, user.hospitalId);
  if (!claim) throw new AppError(422, 'Claim could not be submitted — it may no longer be in DRAFT status');

  await auditService.recordAuditEvent({
    user,
    action:     'PMJAY_CLAIM_SUBMITTED',
    entityType: 'pmjay_claim',
    entityId:   claimId,
    oldValue:   { status: existing.status },
    newValue:   { status: claim.status, submittedAt: claim.submittedAt },
    context,
  });

  return { claim };
}

/**
 * Update claim status (admin/billing lifecycle transitions).
 * Handles: UNDER_REVIEW, APPROVED, REJECTED, PAID.
 */
async function updateClaimStatus(user, data, context) {
  if (!hasPermission(user, 'pmjay.claim.update')) {
    throw new AppError(403, 'You do not have permission to update PM-JAY claim status');
  }

  const existing = await pmjayClaimRepository.findClaimById(data.claim_id, user.hospitalId);
  if (!existing) throw new AppError(404, 'PM-JAY claim not found');

  assertValidTransition(existing.status, data.status);

  // Rejection requires a reason
  if (data.status === 'REJECTED' && !data.rejection_reason?.trim()) {
    throw new AppError(422, 'rejection_reason is required when rejecting a claim');
  }

  const claim = await pmjayClaimRepository.updateClaimStatus(data.claim_id, user.hospitalId, {
    status:           data.status,
    rejection_reason: data.rejection_reason || null,
  });

  // Map status → audit event name
  const EVENT_MAP = {
    APPROVED: 'PMJAY_CLAIM_APPROVED',
    REJECTED: 'PMJAY_CLAIM_REJECTED',
    PAID:     'PMJAY_CLAIM_PAID',
  };
  const auditAction = EVENT_MAP[data.status] || `PMJAY_CLAIM_STATUS_${data.status}`;

  await auditService.recordAuditEvent({
    user,
    action:     auditAction,
    entityType: 'pmjay_claim',
    entityId:   data.claim_id,
    oldValue:   { status: existing.status },
    newValue:   {
      status:          claim.status,
      rejectionReason: claim.rejectionReason || undefined,
      approvedAt:      claim.approvedAt      || undefined,
      paidAt:          claim.paidAt          || undefined,
    },
    context,
  });

  return { claim };
}

module.exports = {
  getClaimById,
  getClaimsByPatient,
  createClaim,
  submitClaim,
  updateClaimStatus,
};
