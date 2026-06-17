'use strict';

/**
 * abhaController.js
 * Thin Zod-validated controller for ABHA endpoints.
 * All business logic lives in abhaService.js.
 */

const { z } = require('zod');
const abhaService = require('../services/abhaService');
const { asyncHandler } = require('../middlewares/asyncHandler');

// ─── Validation Schemas ───────────────────────────────────────────────────────

const patientIdSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

/**
 * ABHA numbers are 14 numeric digits.
 * NHA spec allows an optional hyphen-separated form (XX-XXXX-XXXX-XXXX) for display,
 * but the canonical stored form is always 14 digits — we strip hyphens on receipt.
 */
const linkAbhaSchema = z.object({
  abha_number: z
    .string()
    .trim()
    .transform((val) => val.replace(/[-\s]/g, ''))
    .refine((val) => /^\d{14}$/.test(val), {
      message: 'ABHA number must be exactly 14 digits (hyphens are allowed as separators)',
    }),
  abha_address: z
    .string()
    .trim()
    .max(100)
    .regex(/^[a-zA-Z0-9._+-]+@abdm$/, {
      message: 'ABHA address must be in the format user@abdm',
    })
    .optional()
    .or(z.literal(''))
    .transform((val) => val || undefined),
});

const verifyAbhaSchema = z.object({
  verification_status: z.enum(['pending', 'verified', 'failed'], {
    errorMap: () => ({ message: 'verification_status must be one of: pending, verified, failed' }),
  }),
  verified_at: z.string().datetime({ offset: true }).optional(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/abha/:patientId
 * Returns the patient's ABHA record, or { abha: null } if not linked.
 */
const getAbha = asyncHandler(async (req, res) => {
  const { patientId } = patientIdSchema.parse(req.params);
  const result = await abhaService.getAbha(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/abha/:patientId/link
 * Link a new ABHA number to a patient (creates a new record).
 */
const linkAbha = asyncHandler(async (req, res) => {
  const { patientId } = patientIdSchema.parse(req.params);
  const payload = linkAbhaSchema.parse(req.body);
  const result = await abhaService.linkAbha(req.user, patientId, payload, req.auditContext);
  res.status(201).json(result);
});

/**
 * PUT /api/v1/abha/:patientId/verify
 * Update verification status of an existing ABHA record.
 */
const verifyAbha = asyncHandler(async (req, res) => {
  const { patientId } = patientIdSchema.parse(req.params);
  const payload = verifyAbhaSchema.parse(req.body);
  const result = await abhaService.verifyAbha(req.user, patientId, payload, req.auditContext);
  res.json(result);
});

/**
 * DELETE /api/v1/abha/:patientId/unlink
 * Hard-delete the ABHA record (unlink).
 */
const unlinkAbha = asyncHandler(async (req, res) => {
  const { patientId } = patientIdSchema.parse(req.params);
  const result = await abhaService.unlinkAbha(req.user, patientId, req.auditContext);
  res.json(result);
});

module.exports = {
  getAbha,
  linkAbha,
  verifyAbha,
  unlinkAbha,
};
