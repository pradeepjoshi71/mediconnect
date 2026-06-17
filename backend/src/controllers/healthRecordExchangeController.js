'use strict';

/**
 * healthRecordExchangeController.js
 * Thin Zod-validated controller for Health Record Exchange endpoints.
 */

const { z }                        = require('zod');
const healthRecordExchangeService  = require('../services/healthRecordExchangeService');
const { asyncHandler }             = require('../middlewares/asyncHandler');

const patientIdParamSchema = z.object({
  patientId: z.coerce.number().int().positive(),
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/health-record/patient/:patientId
 * Export patient demographics as FHIR Patient bundle.
 */
const getPatientFHIR = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await healthRecordExchangeService.generatePatientFHIR(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * GET /api/v1/health-record/encounter/:patientId
 * Export all clinical encounters as FHIR Encounter bundle.
 */
const getEncounterFHIR = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await healthRecordExchangeService.generateEncounterFHIR(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * GET /api/v1/health-record/prescription/:patientId
 * Export all prescriptions as FHIR MedicationRequest bundle.
 */
const getPrescriptionFHIR = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await healthRecordExchangeService.generatePrescriptionFHIR(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * GET /api/v1/health-record/lab-report/:patientId
 * Export all lab orders + reports as FHIR DiagnosticReport bundle.
 */
const getLabReportFHIR = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await healthRecordExchangeService.generateLabReportFHIR(req.user, patientId, req.auditContext);
  res.json(result);
});

/**
 * GET /api/v1/health-record/clinical-document/:patientId
 * Export full clinical document as a FHIR Bundle (all resource types).
 * Primary ABDM HIE export endpoint.
 */
const getClinicalDocumentFHIR = asyncHandler(async (req, res) => {
  const { patientId } = patientIdParamSchema.parse(req.params);
  const result = await healthRecordExchangeService.generateClinicalDocumentFHIR(req.user, patientId, req.auditContext);
  res.json(result);
});

module.exports = {
  getPatientFHIR,
  getEncounterFHIR,
  getPrescriptionFHIR,
  getLabReportFHIR,
  getClinicalDocumentFHIR,
};
