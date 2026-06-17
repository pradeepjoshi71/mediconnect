'use strict';

/**
 * abdmCareContextController.js
 * Thin Zod-validated controller for ABDM Care Context endpoints.
 */

const { z }                     = require('zod');
const abdmCareContextService    = require('../services/abdmCareContextService');
const { asyncHandler }          = require('../middlewares/asyncHandler');

// ─── Schemas ──────────────────────────────────────────────────────────────────

const patientIdParamSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

const linkContextSchema = z.object({
  patient_id:              z.coerce.number().int().positive(),
  care_context_reference:  z
    .string()
    .trim()
    .min(1, 'care_context_reference is required')
    .max(100, 'care_context_reference must be ≤ 100 characters')
    .regex(/^[A-Za-z0-9_\-:.]+$/, {
      message: 'care_context_reference may only contain letters, digits, underscores, hyphens, colons, and dots',
    }),
  display_name: z
    .string()
    .trim()
    .min(1, 'display_name is required')
    .max(200, 'display_name must be ≤ 200 characters'),
  abha_id: z.coerce.number().int().positive().optional(),
});

const unlinkContextSchema = z.object({
  context_id: z.coerce.number().int().positive(),
  patient_id: z.coerce.number().int().positive(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/abdm/care-context/:patientId
 * Returns all care contexts for a patient + activeCount.
 */
const getCareContexts = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await abdmCareContextService.getCareContexts(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/abdm/care-context/link
 * Link a new care context.
 */
const linkCareContext = asyncHandler(async (req, res) => {
  const payload = linkContextSchema.parse(req.body);
  const result  = await abdmCareContextService.linkCareContext(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

/**
 * POST /api/v1/abdm/care-context/unlink
 * Unlink (soft-deactivate) a care context.
 */
const unlinkCareContext = asyncHandler(async (req, res) => {
  const payload = unlinkContextSchema.parse(req.body);
  const result  = await abdmCareContextService.unlinkCareContext(req.user, payload, req.auditContext);
  res.json(result);
});

module.exports = { getCareContexts, linkCareContext, unlinkCareContext };
