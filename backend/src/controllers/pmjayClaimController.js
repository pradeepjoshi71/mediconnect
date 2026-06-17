'use strict';

/**
 * pmjayClaimController.js
 * Thin Zod-validated controller for PM-JAY Claim endpoints.
 */

const { z }               = require('zod');
const pmjayClaimService   = require('../services/pmjayClaimService');
const { asyncHandler }    = require('../middlewares/asyncHandler');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const claimIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const patientIdParamSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

const createClaimSchema = z.object({
  patient_id:     z.coerce.number().int().positive(),
  claim_amount:   z.coerce.number().positive('Claim amount must be greater than 0'),
  appointment_id: z.coerce.number().int().positive().optional(),
  invoice_id:     z.coerce.number().int().positive().optional(),
});

const submitClaimSchema = z.object({
  claim_id: z.coerce.number().int().positive(),
});

const updateStatusSchema = z.object({
  claim_id:         z.coerce.number().int().positive(),
  status:           z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PAID']),
  rejection_reason: z.string().trim().max(1000).optional(),
}).refine(
  (d) => d.status !== 'REJECTED' || (d.rejection_reason && d.rejection_reason.trim().length > 0),
  { message: 'rejection_reason is required when status is REJECTED', path: ['rejection_reason'] }
);

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/pmjay/claims/:id
 */
const getClaimById = asyncHandler(async (req, res) => {
  const { id } = claimIdParamSchema.parse(req.params);
  const result  = await pmjayClaimService.getClaimById(req.user, id, req.auditContext);
  res.json(result);
});

/**
 * GET /api/v1/pmjay/claims/patient/:patientId
 */
const getClaimsByPatient = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await pmjayClaimService.getClaimsByPatient(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/pmjay/claims/create
 * Draft a new PM-JAY claim.
 */
const createClaim = asyncHandler(async (req, res) => {
  const payload = createClaimSchema.parse(req.body);
  const result  = await pmjayClaimService.createClaim(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

/**
 * POST /api/v1/pmjay/claims/submit
 * Submit a DRAFT claim.
 */
const submitClaim = asyncHandler(async (req, res) => {
  const { claim_id } = submitClaimSchema.parse(req.body);
  const result = await pmjayClaimService.submitClaim(req.user, claim_id, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/pmjay/claims/update-status
 * Move a claim through UNDER_REVIEW → APPROVED / REJECTED → PAID.
 */
const updateClaimStatus = asyncHandler(async (req, res) => {
  const payload = updateStatusSchema.parse(req.body);
  const result  = await pmjayClaimService.updateClaimStatus(req.user, payload, req.auditContext);
  res.json(result);
});

module.exports = {
  getClaimById,
  getClaimsByPatient,
  createClaim,
  submitClaim,
  updateClaimStatus,
};
