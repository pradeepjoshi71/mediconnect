'use strict';

/**
 * abdmConsentController.js
 * Thin Zod-validated controller for ABDM Consent endpoints.
 */

const { z }                  = require('zod');
const abdmConsentService     = require('../services/abdmConsentService');
const { asyncHandler }       = require('../middlewares/asyncHandler');

// ─── Shared Schemas ───────────────────────────────────────────────────────────

const patientIdParamSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

const CONSENT_TYPES = z.enum([
  'data_access',
  'health_record_share',
  'telemedicine',
  'research',
  'emergency_access',
  'general',
]);

const grantConsentSchema = z.object({
  patient_id:   z.coerce.number().int().positive(),
  consent_type: CONSENT_TYPES,
  expires_at:   z.string().datetime({ offset: true }).optional(),
  metadata:     z.record(z.string(), z.unknown()).optional(),
});

const revokeConsentSchema = z.object({
  consent_id: z.coerce.number().int().positive(),
  patient_id: z.coerce.number().int().positive(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/abdm/consent/:patientId
 * Returns full consent history + active-per-type summary.
 */
const getConsents = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await abdmConsentService.getConsents(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * POST /api/v1/abdm/consent/grant
 * Record a new consent grant for a patient.
 */
const grantConsent = asyncHandler(async (req, res) => {
  const payload = grantConsentSchema.parse(req.body);
  const result  = await abdmConsentService.grantConsent(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

/**
 * POST /api/v1/abdm/consent/revoke
 * Revoke an active consent record by ID.
 */
const revokeConsent = asyncHandler(async (req, res) => {
  const payload = revokeConsentSchema.parse(req.body);
  const result  = await abdmConsentService.revokeConsent(req.user, payload, req.auditContext);
  res.json(result);
});

module.exports = { getConsents, grantConsent, revokeConsent };
