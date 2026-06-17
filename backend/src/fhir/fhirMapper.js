'use strict';

/**
 * fhirMapper.js
 *
 * Unified FHIR mapping facade for Phase 10.3 Health Record Exchange.
 *
 * Re-exports all FHIR R4 resource mappers (Phase 6.1 + Phase 10.3) from
 * a single point of import. The health record exchange service uses only
 * this file, so mapper internals remain easily swappable.
 *
 * Resources supported:
 *   Patient             → patientMapper.toFhirPatient
 *   Encounter           → encounterMapper.toFhirEncounter
 *   Observation         → observationMapper.toFhirObservationsFromVitals
 *                         observationMapper.toFhirObservationFromAllergy
 *   DiagnosticReport    → diagnosticReportMapper.toFhirDiagnosticReport
 *   MedicationRequest   → medicationRequestMapper.toFhirMedicationRequest
 *   DocumentReference   → documentReferenceMapper.toFhirDocumentReference
 */

const { toFhirPatient }                                   = require('./mappers/patientMapper');
const { toFhirEncounter }                                 = require('./mappers/encounterMapper');
const { toFhirObservationsFromVitals,
        toFhirObservationFromAllergy }                    = require('./mappers/observationMapper');
const { toFhirDiagnosticReport }                          = require('./mappers/diagnosticReportMapper');
const { toFhirMedicationRequest }                         = require('./mappers/medicationRequestMapper');
const { toFhirDocumentReference }                         = require('./mappers/documentReferenceMapper');

// ─── FHIR Bundle Builder ──────────────────────────────────────────────────────

/**
 * buildFhirBundle — wraps one or more FHIR resources in a FHIR R4 Bundle.
 *
 * @param {object[]} resources  — array of FHIR resource objects
 * @param {'document'|'collection'|'searchset'} type — FHIR Bundle type
 * @param {string}  [id]        — optional Bundle logical id
 * @returns {object} FHIR R4 Bundle
 */
function buildFhirBundle(resources, type = 'collection', id) {
  const entries = resources
    .filter(Boolean)
    .flat()  // flatten arrays from vitals (returns [])
    .filter(Boolean)
    .map((resource) => ({ resource }));

  return {
    resourceType: 'Bundle',
    id:        id || `bundle-${Date.now()}`,
    type,
    timestamp: new Date().toISOString(),
    total:     entries.length,
    entry:     entries,
  };
}

module.exports = {
  // Individual mappers
  toFhirPatient,
  toFhirEncounter,
  toFhirObservationsFromVitals,
  toFhirObservationFromAllergy,
  toFhirDiagnosticReport,
  toFhirMedicationRequest,
  toFhirDocumentReference,

  // Bundle helper
  buildFhirBundle,
};
