'use strict';

/**
 * healthRecordExchangeRoutes.js
 * Express router for Health Record Exchange endpoints.
 *
 * Mounted at: /api/v1/health-record
 *
 * All endpoints are GET (read-only mapping, no writes).
 *
 * Endpoints:
 *   GET /api/v1/health-record/patient/:patientId           → FHIR Patient bundle
 *   GET /api/v1/health-record/encounter/:patientId         → FHIR Encounter bundle
 *   GET /api/v1/health-record/prescription/:patientId      → FHIR MedicationRequest bundle
 *   GET /api/v1/health-record/lab-report/:patientId        → FHIR DiagnosticReport bundle
 *   GET /api/v1/health-record/clinical-document/:patientId → Full FHIR clinical document Bundle
 */

const express                       = require('express');
const healthRecordExchangeController = require('../controllers/healthRecordExchangeController');
const authMiddleware                 = require('../middlewares/authMiddleware');
const permissionMiddleware           = require('../middlewares/permissionMiddleware');

const router = express.Router();

// All routes require authentication and the export permission
const guard = [authMiddleware, permissionMiddleware('healthrecord.export')];

router.get('/patient/:patientId',           ...guard, healthRecordExchangeController.getPatientFHIR);
router.get('/encounter/:patientId',         ...guard, healthRecordExchangeController.getEncounterFHIR);
router.get('/prescription/:patientId',      ...guard, healthRecordExchangeController.getPrescriptionFHIR);
router.get('/lab-report/:patientId',        ...guard, healthRecordExchangeController.getLabReportFHIR);
router.get('/clinical-document/:patientId', ...guard, healthRecordExchangeController.getClinicalDocumentFHIR);

module.exports = router;
