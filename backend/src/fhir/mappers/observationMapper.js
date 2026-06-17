'use strict';

/**
 * observationMapper.js
 *
 * Maps MediConnect vitals (from medical_records.vitals JSONB) and
 * individual diagnosis/allergy rows to FHIR R4 Observation resources.
 * Spec: https://hl7.org/fhir/R4/observation.html
 *
 * Phase 10.3 — read-only; does not modify any existing tables.
 */

const { buildFhirId } = require('../middleware/fhirTenantGuard');

const LOINC = 'http://loinc.org';
const UCUM  = 'http://unitsofmeasure.org';

// ── Vital sign LOINC code registry ───────────────────────────────────────────
const VITAL_LOINC = {
  systolicBP:    { code: '8480-6',  display: 'Systolic blood pressure',  unit: 'mmHg',      ucum: 'mm[Hg]' },
  diastolicBP:   { code: '8462-4',  display: 'Diastolic blood pressure', unit: 'mmHg',      ucum: 'mm[Hg]' },
  heartRate:     { code: '8867-4',  display: 'Heart rate',               unit: 'beats/min', ucum: '/min'   },
  temperature:   { code: '8310-5',  display: 'Body temperature',         unit: '°C',        ucum: 'Cel'    },
  weight:        { code: '29463-7', display: 'Body weight',              unit: 'kg',        ucum: 'kg'     },
  height:        { code: '8302-2',  display: 'Body height',              unit: 'cm',        ucum: 'cm'     },
  bmi:           { code: '39156-5', display: 'Body mass index (BMI)',    unit: 'kg/m2',     ucum: 'kg/m2'  },
  oxygenSat:     { code: '2708-6',  display: 'Oxygen saturation',        unit: '%',         ucum: '%'      },
  respiratoryRate:{ code: '9279-1', display: 'Respiratory rate',         unit: 'breaths/min', ucum: '/min' },
  bloodGlucose:  { code: '15074-8', display: 'Glucose [Moles/volume]',   unit: 'mmol/L',    ucum: 'mmol/L' },
};

/**
 * toFhirObservationsFromVitals — expand a medical_record.vitals JSONB into
 * a list of individual FHIR Observation resources (one per vital sign).
 *
 * @param {object} medRecord — clinicalRepository medical_record row
 * @returns {object[]} array of FHIR R4 Observation resources
 */
function toFhirObservationsFromVitals(medRecord) {
  if (!medRecord) return [];
  const vitals = medRecord.vitals;
  if (!vitals || typeof vitals !== 'object') return [];

  const patientFhirId  = buildFhirId(medRecord.hospitalId, medRecord.patientId);
  const encounterFhirId = buildFhirId(medRecord.hospitalId, medRecord.id);
  const observations   = [];

  for (const [key, meta] of Object.entries(VITAL_LOINC)) {
    const rawValue = vitals[key] ?? vitals[_camelToSnake(key)];
    if (rawValue == null) continue;

    const numericVal = parseFloat(rawValue);
    const obsId = buildFhirId(medRecord.hospitalId, `${medRecord.id}-vital-${key}`);

    observations.push(_clean({
      resourceType: 'Observation',
      id:     obsId,
      status: 'final',

      meta: {
        versionId:   '1',
        lastUpdated: medRecord.createdAt ? new Date(medRecord.createdAt).toISOString() : new Date().toISOString(),
        tag: [{
          system:  'https://mediconnect.io/tenant',
          code:    String(medRecord.hospitalId),
          display: `Hospital ${medRecord.hospitalId}`,
        }],
      },

      category: [{
        coding: [{
          system:  'http://terminology.hl7.org/CodeSystem/observation-category',
          code:    'vital-signs',
          display: 'Vital Signs',
        }],
      }],

      code: {
        coding: [{ system: LOINC, code: meta.code, display: meta.display }],
        text:   meta.display,
      },

      subject: { reference: `Patient/${patientFhirId}` },
      encounter: { reference: `Encounter/${encounterFhirId}` },

      effectiveDateTime: medRecord.createdAt ? new Date(medRecord.createdAt).toISOString() : undefined,

      valueQuantity: isNaN(numericVal) ? undefined : {
        value:  numericVal,
        unit:   meta.unit,
        system: UCUM,
        code:   meta.ucum,
      },

      valueString: isNaN(numericVal) ? String(rawValue) : undefined,
    }));
  }

  return observations;
}

/**
 * toFhirObservationFromAllergy — map an allergies row to a FHIR Observation
 * (category: social-history / allergy).
 *
 * @param {object} allergyRow — clinicalRepository.listAllergiesByPatient row
 * @param {number} hospitalId
 * @returns {object} FHIR R4 Observation
 */
function toFhirObservationFromAllergy(allergyRow, hospitalId) {
  if (!allergyRow) return null;
  const fhirId        = buildFhirId(hospitalId, `allergy-${allergyRow.id}`);
  const patientFhirId = buildFhirId(hospitalId, allergyRow.patientId);

  return _clean({
    resourceType: 'Observation',
    id:     fhirId,
    status: allergyRow.status === 'inactive' ? 'cancelled' : 'final',

    meta: {
      versionId:   '1',
      lastUpdated: allergyRow.updatedAt ? new Date(allergyRow.updatedAt).toISOString()
                 : allergyRow.createdAt ? new Date(allergyRow.createdAt).toISOString()
                 : new Date().toISOString(),
      tag: [{
        system:  'https://mediconnect.io/tenant',
        code:    String(hospitalId),
        display: `Hospital ${hospitalId}`,
      }],
    },

    category: [{
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/observation-category',
        code:    'social-history',
        display: 'Social History',
      }],
    }],

    code: {
      coding: [{
        system:  LOINC,
        code:    '52473-6',
        display: 'Allergy',
      }],
      text: `Allergy: ${allergyRow.allergen}`,
    },

    subject:          { reference: `Patient/${patientFhirId}` },
    effectiveDateTime: allergyRow.onsetDate ? new Date(allergyRow.onsetDate).toISOString() : undefined,

    valueString: [
      allergyRow.allergen,
      allergyRow.reaction    ? `Reaction: ${allergyRow.reaction}`   : null,
      allergyRow.severity    ? `Severity: ${allergyRow.severity}`   : null,
      allergyRow.allergyType ? `Type: ${allergyRow.allergyType}`    : null,
    ].filter(Boolean).join('. '),

    note: allergyRow.notes ? [{ text: allergyRow.notes }] : undefined,
  });
}

function _camelToSnake(str) {
  return str.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function _clean(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => (v === undefined ? undefined : v)));
}

module.exports = {
  toFhirObservationsFromVitals,
  toFhirObservationFromAllergy,
};
