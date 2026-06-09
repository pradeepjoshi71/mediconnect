/**
 * validators.test.js — Unit tests for FHIR R4 Zod validation schemas.
 *
 * Run: node --test backend/src/fhir/tests/validators.test.js
 */
'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const {
  FhirPatientSchema,
  FhirPractitionerSchema,
  FhirAppointmentSchema,
  FhirEncounterSchema,
  validateFhir,
} = require('../validators/fhirValidators');

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPatient = {
  resourceType: 'Patient',
  name: [{ text: 'Jane Smith', family: 'Smith', given: ['Jane'] }],
  telecom: [
    { system: 'email', value: 'jane.smith@example.com' },
    { system: 'phone', value: '+91-9000000001' },
  ],
  gender:    'female',
  birthDate: '1985-03-22',
};

const validPractitioner = {
  resourceType: 'Practitioner',
  name: [{ text: 'Dr. Priya Sharma', family: 'Sharma', given: ['Priya'] }],
  telecom: [
    { system: 'email', value: 'priya@hospital.com' },
  ],
  qualification: [{
    code: {
      coding: [{ system: 'https://mediconnect.io/fhir/CodeSystem/specialization', code: 'neurology', display: 'Neurology' }],
      text: 'Neurology',
    },
  }],
};

const validAppointment = {
  resourceType: 'Appointment',
  status:       'booked',
  start:        '2024-07-15T09:00:00.000Z',
  end:          '2024-07-15T09:30:00.000Z',
  participant: [
    { actor: { reference: 'Patient/2-17', display: 'Jane Smith' }, required: 'required', status: 'accepted' },
    { actor: { reference: 'Practitioner/2-1', display: 'Dr. Priya' }, required: 'required', status: 'accepted' },
  ],
  description: 'Follow-up consultation',
};

const validEncounter = {
  resourceType: 'Encounter',
  status:       'finished',
  class:        { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'Ambulatory' },
  subject:      { reference: 'Patient/2-17', display: 'Jane Smith' },
  participant: [{
    individual: { reference: 'Practitioner/2-1', display: 'Dr. Priya' },
    type: [{ coding: [{ code: 'PPRF' }] }],
  }],
  reasonCode: [{ text: 'Fever and cough' }],
};

// ── Patient Validation ────────────────────────────────────────────────────────

describe('FhirPatientSchema', () => {
  test('accepts a valid Patient', () => {
    const { data, error } = validateFhir(FhirPatientSchema, validPatient);
    assert.ok(!error, `Unexpected error: ${error?.message}`);
    assert.equal(data.resourceType, 'Patient');
  });

  test('rejects missing resourceType', () => {
    const { error } = validateFhir(FhirPatientSchema, { ...validPatient, resourceType: 'Observation' });
    assert.ok(error);
  });

  test('rejects empty name array', () => {
    const { error } = validateFhir(FhirPatientSchema, { ...validPatient, name: [] });
    assert.ok(error);
  });

  test('rejects telecom without email', () => {
    const bad = { ...validPatient, telecom: [{ system: 'phone', value: '123' }] };
    const { error } = validateFhir(FhirPatientSchema, bad);
    assert.ok(error);
    assert.ok(error.message.includes('email'));
  });

  test('rejects invalid gender code', () => {
    const bad = { ...validPatient, gender: 'nonbinary' };
    const { error } = validateFhir(FhirPatientSchema, bad);
    assert.ok(error);
  });

  test('rejects malformed birthDate', () => {
    const bad = { ...validPatient, birthDate: '22-03-1985' };
    const { error } = validateFhir(FhirPatientSchema, bad);
    assert.ok(error);
    assert.ok(error.message.includes('YYYY-MM-DD'));
  });

  test('accepts Patient without optional fields', () => {
    const minimal = {
      resourceType: 'Patient',
      name:    [{ text: 'Test User' }],
      telecom: [{ system: 'email', value: 'test@example.com' }],
    };
    const { error } = validateFhir(FhirPatientSchema, minimal);
    assert.ok(!error);
  });

  test('passes through extra FHIR fields (passthrough)', () => {
    const withExtra = { ...validPatient, identifier: [{ value: 'MRN-001' }], active: true };
    const { data, error } = validateFhir(FhirPatientSchema, withExtra);
    assert.ok(!error);
    assert.ok(data.identifier);
    assert.equal(data.active, true);
  });
});

// ── Practitioner Validation ───────────────────────────────────────────────────

describe('FhirPractitionerSchema', () => {
  test('accepts a valid Practitioner', () => {
    const { data, error } = validateFhir(FhirPractitionerSchema, validPractitioner);
    assert.ok(!error, `Unexpected error: ${error?.message}`);
    assert.equal(data.resourceType, 'Practitioner');
  });

  test('rejects missing name', () => {
    const { error } = validateFhir(FhirPractitionerSchema, { ...validPractitioner, name: [] });
    assert.ok(error);
  });

  test('rejects telecom without email', () => {
    const bad = { ...validPractitioner, telecom: [{ system: 'phone', value: '123' }] };
    const { error } = validateFhir(FhirPractitionerSchema, bad);
    assert.ok(error);
  });

  test('rejects missing qualification', () => {
    const { error } = validateFhir(FhirPractitionerSchema, { ...validPractitioner, qualification: [] });
    assert.ok(error);
  });
});

// ── Appointment Validation ────────────────────────────────────────────────────

describe('FhirAppointmentSchema', () => {
  test('accepts a valid Appointment', () => {
    const { data, error } = validateFhir(FhirAppointmentSchema, validAppointment);
    assert.ok(!error, `Unexpected error: ${error?.message}`);
    assert.equal(data.status, 'booked');
  });

  test('rejects invalid status', () => {
    const { error } = validateFhir(FhirAppointmentSchema, { ...validAppointment, status: 'active' });
    assert.ok(error);
  });

  test('rejects missing start', () => {
    const { error } = validateFhir(FhirAppointmentSchema, { ...validAppointment, start: undefined });
    assert.ok(error);
  });

  test('rejects non-ISO start datetime', () => {
    const { error } = validateFhir(FhirAppointmentSchema, { ...validAppointment, start: '2024-07-15 09:00' });
    assert.ok(error);
  });

  test('rejects participant without Patient', () => {
    const bad = {
      ...validAppointment,
      participant: [{ actor: { reference: 'Practitioner/2-1' }, required: 'required', status: 'accepted' }],
    };
    const { error } = validateFhir(FhirAppointmentSchema, bad);
    assert.ok(error);
    assert.ok(error.message.toLowerCase().includes('patient'));
  });

  test('rejects participant without Practitioner', () => {
    const bad = {
      ...validAppointment,
      participant: [{ actor: { reference: 'Patient/2-17' }, required: 'required', status: 'accepted' }],
    };
    const { error } = validateFhir(FhirAppointmentSchema, bad);
    assert.ok(error);
    assert.ok(error.message.toLowerCase().includes('practitioner'));
  });

  test('accepts waitlist status', () => {
    const { error } = validateFhir(FhirAppointmentSchema, { ...validAppointment, status: 'waitlist' });
    assert.ok(!error);
  });
});

// ── Encounter Validation ──────────────────────────────────────────────────────

describe('FhirEncounterSchema', () => {
  test('accepts a valid Encounter', () => {
    const { data, error } = validateFhir(FhirEncounterSchema, validEncounter);
    assert.ok(!error, `Unexpected error: ${error?.message}`);
    assert.equal(data.status, 'finished');
  });

  test('rejects invalid status', () => {
    const { error } = validateFhir(FhirEncounterSchema, { ...validEncounter, status: 'completed' });
    assert.ok(error);
  });

  test('rejects subject without Patient reference', () => {
    const bad = { ...validEncounter, subject: { reference: 'Observation/1' } };
    const { error } = validateFhir(FhirEncounterSchema, bad);
    assert.ok(error);
    assert.ok(error.message.includes('Patient'));
  });

  test('rejects participant without Practitioner reference', () => {
    const bad = {
      ...validEncounter,
      participant: [{ individual: { reference: 'Patient/2-17' } }],
    };
    const { error } = validateFhir(FhirEncounterSchema, bad);
    assert.ok(error);
    assert.ok(error.message.includes('Practitioner'));
  });

  test('rejects missing participant', () => {
    const { error } = validateFhir(FhirEncounterSchema, { ...validEncounter, participant: [] });
    assert.ok(error);
  });

  test('accepts Encounter without optional reasonCode', () => {
    const minimal = { ...validEncounter };
    delete minimal.reasonCode;
    const { error } = validateFhir(FhirEncounterSchema, minimal);
    assert.ok(!error);
  });
});
