'use strict';

/**
 * medicationRequestMapper.js
 *
 * Maps a MediConnect prescriptions row to a FHIR R4 MedicationRequest resource.
 * Spec: https://hl7.org/fhir/R4/medicationrequest.html
 *
 * Phase 10.3 — read-only; does not modify any existing tables.
 */

const { buildFhirId } = require('../middleware/fhirTenantGuard');

/**
 * toFhirMedicationRequest — convert a prescriptions row to FHIR R4 MedicationRequest.
 *
 * @param {object} row — prescriptions repository row
 * @returns {object} FHIR R4 MedicationRequest resource
 */
function toFhirMedicationRequest(row) {
  if (!row) return null;

  const fhirId        = buildFhirId(row.hospitalId, row.id);
  const patientFhirId = buildFhirId(row.hospitalId, row.patientId);
  const doctorFhirId  = row.doctorId ? buildFhirId(row.hospitalId, row.doctorId) : null;
  const encFhirId     = row.medicalRecordId ? buildFhirId(row.hospitalId, row.medicalRecordId) : null;

  const resource = {
    resourceType: 'MedicationRequest',
    id:     fhirId,
    status: row.status || 'active',
    intent: 'order',

    meta: {
      versionId:   '1',
      lastUpdated: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(row.hospitalId),
        display: `Hospital ${row.hospitalId}`,
      }],
    },

    // ── Medication ────────────────────────────────────────────────────────────
    medicationCodeableConcept: {
      text: row.medicationName,
      coding: [{
        system:  'https://mediconnect.io/fhir/CodeSystem/medication',
        display: row.medicationName,
      }],
    },

    // ── Subject ───────────────────────────────────────────────────────────────
    subject: {
      reference: `Patient/${patientFhirId}`,
    },

    // ── Requester (Prescribing doctor) ────────────────────────────────────────
    requester: doctorFhirId ? {
      reference: `Practitioner/${doctorFhirId}`,
    } : undefined,

    // ── Encounter ─────────────────────────────────────────────────────────────
    encounter: encFhirId ? {
      reference: `Encounter/${encFhirId}`,
    } : undefined,

    // ── Authored On ───────────────────────────────────────────────────────────
    authoredOn: row.createdAt ? new Date(row.createdAt).toISOString() : undefined,

    // ── Dosage Instruction ────────────────────────────────────────────────────
    dosageInstruction: _buildDosageInstruction(row),
  };

  return _clean(resource);
}

function _buildDosageInstruction(row) {
  const parts = [];

  if (row.frequency)    parts.push(row.frequency);
  if (row.instructions) parts.push(row.instructions);

  return [{
    text:   [row.dosage, row.frequency, row.instructions].filter(Boolean).join(', ') || undefined,
    timing: row.frequency ? {
      code: { text: row.frequency },
    } : undefined,
    doseAndRate: row.dosage ? [{
      doseQuantity: { value: row.dosage },
    }] : undefined,
    patientInstruction: row.instructions || undefined,
    boundsDuration: row.durationDays != null ? {
      value:  row.durationDays,
      unit:   'days',
      system: 'http://unitsofmeasure.org',
      code:   'd',
    } : undefined,
  }];
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = { toFhirMedicationRequest };
