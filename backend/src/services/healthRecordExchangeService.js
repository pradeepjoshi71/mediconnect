'use strict';

/**
 * healthRecordExchangeService.js
 *
 * Phase 10.3 — ABDM Health Record Exchange Foundation.
 *
 * Generates FHIR R4-formatted payloads from existing MediConnect data.
 *
 * Rules:
 *   • Read-only — no INSERT/UPDATE/DELETE on any table
 *   • Multi-tenant safe — all queries scoped to user.hospitalId
 *   • Audit-logged — every export is recorded
 *   • No production ABDM dependency — payloads are LOCAL FHIR documents only
 *
 * All functions return { fhirBundle, resourceCount, generatedAt }
 */

const fhirMapper          = require('../fhir/fhirMapper');
const patientRepository   = require('../repositories/patientRepository');
const clinicalRepository  = require('../repositories/clinicalRepository');
const labRepository       = require('../repositories/labRepository');
const fileRepository      = require('../repositories/fileRepository');
const auditService        = require('./auditService');
const { AppError }        = require('../utils/http');
const { hasPermission }   = require('../utils/rbac');

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function assertPatientReadable(user, patientId) {
  const patient = await patientRepository.findPatientById(patientId, user.hospitalId);
  if (!patient) throw new AppError(404, 'Patient not found');
  return patient;
}

function wrap(resources, label, patientId) {
  const bundle = fhirMapper.buildFhirBundle(
    Array.isArray(resources) ? resources : [resources],
    'collection',
    `${label}-${patientId}-${Date.now()}`
  );
  return {
    fhirBundle:    bundle,
    resourceCount: bundle.total,
    generatedAt:   bundle.timestamp,
  };
}

async function auditExport(user, action, patientId, metadata, context) {
  await auditService.recordAuditEvent({
    user,
    action,
    entityType: 'health_record',
    entityId:   patientId,
    metadata,
    context,
  });
}

// ─── Exported Service Functions ───────────────────────────────────────────────

/**
 * generatePatientFHIR
 * Exports patient demographics as a FHIR Patient resource bundle.
 */
async function generatePatientFHIR(user, patientId, context) {
  if (!hasPermission(user, 'healthrecord.export')) {
    throw new AppError(403, 'You do not have permission to export health records');
  }

  const patient = await assertPatientReadable(user, patientId);
  const fhirPatient = fhirMapper.toFhirPatient({ ...patient, hospitalId: user.hospitalId });
  const result = wrap([fhirPatient], 'patient', patientId);

  await auditExport(user, 'FHIR_PAYLOAD_GENERATED', patientId, {
    event:        'HEALTH_RECORD_EXPORTED',
    resourceType: 'Patient',
    resourceCount: result.resourceCount,
  }, context);

  return result;
}

/**
 * generateEncounterFHIR
 * Exports all medical records (clinical encounters) for a patient as FHIR Encounter bundle.
 */
async function generateEncounterFHIR(user, patientId, context) {
  if (!hasPermission(user, 'healthrecord.export')) {
    throw new AppError(403, 'You do not have permission to export health records');
  }

  await assertPatientReadable(user, patientId);

  const records = await clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patientId);
  const encounters = records.map((r) =>
    fhirMapper.toFhirEncounter({ ...r, hospitalId: user.hospitalId })
  );
  const result = wrap(encounters, 'encounter', patientId);

  await auditExport(user, 'FHIR_PAYLOAD_GENERATED', patientId, {
    event:         'HEALTH_RECORD_EXPORTED',
    resourceType:  'Encounter',
    resourceCount: result.resourceCount,
  }, context);

  return result;
}

/**
 * generatePrescriptionFHIR
 * Exports all prescriptions for a patient as FHIR MedicationRequest bundle.
 */
async function generatePrescriptionFHIR(user, patientId, context) {
  if (!hasPermission(user, 'healthrecord.export')) {
    throw new AppError(403, 'You do not have permission to export health records');
  }

  await assertPatientReadable(user, patientId);

  const records = await clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patientId);
  const recordIds = records.map((r) => r.id);
  const prescriptions = recordIds.length
    ? await clinicalRepository.listPrescriptionsByRecordIds(user.hospitalId, recordIds)
    : [];

  const medRequests = prescriptions.map((p) =>
    fhirMapper.toFhirMedicationRequest({ ...p, hospitalId: user.hospitalId })
  );
  const result = wrap(medRequests, 'prescription', patientId);

  await auditExport(user, 'FHIR_PAYLOAD_GENERATED', patientId, {
    event:         'HEALTH_RECORD_EXPORTED',
    resourceType:  'MedicationRequest',
    resourceCount: result.resourceCount,
  }, context);

  return result;
}

/**
 * generateLabReportFHIR
 * Exports all lab orders (+ reports where available) as FHIR DiagnosticReport bundle.
 */
async function generateLabReportFHIR(user, patientId, context) {
  if (!hasPermission(user, 'healthrecord.export')) {
    throw new AppError(403, 'You do not have permission to export health records');
  }

  await assertPatientReadable(user, patientId);

  const labOrders  = await labRepository.listLabOrders(user.hospitalId, { patientId });
  const labReports = await labRepository.listLabReports(user.hospitalId, { patientId });

  // Map by labOrderId for O(1) join
  const reportsByOrderId = {};
  for (const r of labReports) {
    if (!reportsByOrderId[r.labOrderId]) reportsByOrderId[r.labOrderId] = r;
  }

  const diagnosticReports = labOrders.map((order) =>
    fhirMapper.toFhirDiagnosticReport(
      { ...order, hospitalId: user.hospitalId },
      reportsByOrderId[order.id] || null
    )
  );
  const result = wrap(diagnosticReports, 'labReport', patientId);

  await auditExport(user, 'FHIR_PAYLOAD_GENERATED', patientId, {
    event:         'HEALTH_RECORD_EXPORTED',
    resourceType:  'DiagnosticReport',
    resourceCount: result.resourceCount,
  }, context);

  return result;
}

/**
 * generateClinicalDocumentFHIR
 * Full clinical document bundle: Patient + Encounters + Observations
 * (vitals + allergies) + MedicationRequests + DiagnosticReports + DocumentReferences.
 *
 * This is the primary ABDM HIE export bundle.
 */
async function generateClinicalDocumentFHIR(user, patientId, context) {
  if (!hasPermission(user, 'healthrecord.export')) {
    throw new AppError(403, 'You do not have permission to export health records');
  }

  const patient = await assertPatientReadable(user, patientId);

  // ── Fetch all clinical data in parallel ─────────────────────────────────────
  const [records, labOrders, labReports, allergies, files] = await Promise.all([
    clinicalRepository.listMedicalRecordsByPatient(user.hospitalId, patientId),
    labRepository.listLabOrders(user.hospitalId, { patientId }),
    labRepository.listLabReports(user.hospitalId, { patientId }),
    clinicalRepository.listAllergiesByPatient(user.hospitalId, patientId),
    fileRepository.listFilesByPatient ? fileRepository.listFilesByPatient(user.hospitalId, patientId).catch(() => []) : Promise.resolve([]),
  ]);

  const recordIds = records.map((r) => r.id);
  const prescriptions = recordIds.length
    ? await clinicalRepository.listPrescriptionsByRecordIds(user.hospitalId, recordIds)
    : [];

  const reportsByOrderId = {};
  for (const r of labReports) {
    if (!reportsByOrderId[r.labOrderId]) reportsByOrderId[r.labOrderId] = r;
  }

  // ── Build all FHIR resources ─────────────────────────────────────────────────
  const allResources = [
    // Patient demographics
    fhirMapper.toFhirPatient({ ...patient, hospitalId: user.hospitalId }),

    // Clinical encounters
    ...records.map((r) => fhirMapper.toFhirEncounter({ ...r, hospitalId: user.hospitalId })),

    // Vital sign observations (one per vital per encounter)
    ...records.flatMap((r) => fhirMapper.toFhirObservationsFromVitals({ ...r, hospitalId: user.hospitalId })),

    // Allergy observations
    ...allergies.map((a) => fhirMapper.toFhirObservationFromAllergy(a, user.hospitalId)),

    // Prescriptions
    ...prescriptions.map((p) => fhirMapper.toFhirMedicationRequest({ ...p, hospitalId: user.hospitalId })),

    // Lab reports
    ...labOrders.map((o) => fhirMapper.toFhirDiagnosticReport(
      { ...o, hospitalId: user.hospitalId },
      reportsByOrderId[o.id] || null
    )),

    // Uploaded documents
    ...files.map((f) => fhirMapper.toFhirDocumentReference({ ...f, hospitalId: user.hospitalId })),
  ].filter(Boolean);

  const bundle = fhirMapper.buildFhirBundle(allResources, 'document', `clinical-doc-${patientId}-${Date.now()}`);
  const result = {
    fhirBundle:    bundle,
    resourceCount: bundle.total,
    generatedAt:   bundle.timestamp,
  };

  await auditExport(user, 'FHIR_PAYLOAD_GENERATED', patientId, {
    event:          'HEALTH_RECORD_EXPORTED',
    resourceType:   'ClinicalDocument (Bundle)',
    resourceCount:  result.resourceCount,
    breakdown: {
      encounters:           records.length,
      prescriptions:        prescriptions.length,
      labOrders:            labOrders.length,
      allergyObservations:  allergies.length,
      documents:            files.length,
    },
  }, context);

  return result;
}

module.exports = {
  generatePatientFHIR,
  generateEncounterFHIR,
  generatePrescriptionFHIR,
  generateLabReportFHIR,
  generateClinicalDocumentFHIR,
};
