'use strict';

/**
 * pmjayController.js
 * Thin Zod-validated controller for PM-JAY endpoints.
 */

const { z }             = require('zod');
const pmjayService      = require('../services/pmjayService');
const { asyncHandler }  = require('../middlewares/asyncHandler');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const patientIdParamSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

const PMJAY_ID_REGEX = /^[A-Z0-9\-]{8,20}$/;

const linkSchema = z.object({
  patient_id:       z.coerce.number().int().positive(),
  pmjay_id:         z
    .string()
    .trim()
    .toUpperCase()
    .min(8,  'PM-JAY ID must be at least 8 characters')
    .max(20, 'PM-JAY ID must be at most 20 characters')
    .regex(PMJAY_ID_REGEX, 'PM-JAY ID may only contain uppercase letters, digits, and hyphens'),
  beneficiary_name: z
    .string()
    .trim()
    .min(1,   'Beneficiary name is required')
    .max(200, 'Beneficiary name must be ≤ 200 characters'),
});

const verifySchema = z.object({
  patient_id:          z.coerce.number().int().positive(),
  verification_status: z.enum(['verified', 'failed']),
  eligibility_status:  z.enum(['eligible', 'ineligible', 'pending']).optional(),
});

const unlinkBodySchema = z.object({
  patient_id: z.coerce.number().int().positive(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/pmjay/:patientId
 * Returns PM-JAY details for a patient (null if not enrolled).
 */
const getPmjayDetails = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await pmjayService.getPmjayDetails(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/pmjay/link
 * Link a PM-JAY enrollment.
 */
const linkPmjay = asyncHandler(async (req, res) => {
  const payload = linkSchema.parse(req.body);
  const result  = await pmjayService.linkPmjay(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

/**
 * POST /api/v1/pmjay/verify
 * Verify or fail a PM-JAY enrollment.
 */
const verifyPmjay = asyncHandler(async (req, res) => {
  const payload = verifySchema.parse(req.body);
  const result  = await pmjayService.verifyPmjay(req.user, payload, req.auditContext);
  res.json(result);
});

/**
 * DELETE /api/v1/pmjay/unlink
 * Unlink (remove) a PM-JAY enrollment.
 * Uses DELETE with a JSON body to pass patient_id.
 */
const unlinkPmjay = asyncHandler(async (req, res) => {
  const { patient_id } = unlinkBodySchema.parse(req.body);
  const result = await pmjayService.unlinkPmjay(req.user, patient_id, req.auditContext);
  res.json(result);
});

module.exports = { getPmjayDetails, linkPmjay, verifyPmjay, unlinkPmjay };
