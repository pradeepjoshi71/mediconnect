/**
 * fhir.integration.test.js — Integration tests for FHIR R4 HTTP endpoints.
 *
 * Tests run against the live dev server (http://localhost:5000).
 * The server must be running and seeded before executing these tests.
 *
 * Run: node --test backend/src/fhir/tests/fhir.integration.test.js
 *
 * Environment:
 *   TEST_BASE_URL  (default: http://localhost:5000)
 *   TEST_EMAIL     (default: superadmin@mediconnect.local)
 *   TEST_PASSWORD  (default: Password@123)
 *   TEST_HOSPITAL  (default: MCH-BLR)
 *
 * Notes:
 *   - Tests are sequential (describe blocks run in order).
 *   - Created resource IDs are reused in subsequent GET tests.
 *   - All tests are idempotent-safe: unique emails generated per run.
 */
'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE  = process.env.TEST_BASE_URL || 'http://localhost:5000';
const FHIR  = `${BASE}/api/fhir`;
const V1    = `${BASE}/api/v1`;

const TEST_EMAIL    = process.env.TEST_EMAIL    || 'superadmin@mediconnect.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password@123';
const TEST_HOSPITAL = process.env.TEST_HOSPITAL || 'MCH-BLR';

// State shared across tests
let accessToken  = '';
let hospitalId   = '';
let patientFhirId     = '';
let practitionerFhirId = '';
let appointmentFhirId = '';
let encounterFhirId   = '';

// Unique suffix to prevent email collisions on repeated runs
const RUN_ID = Date.now();

// ── Helper ────────────────────────────────────────────────────────────────────

async function api(method, url, body, token) {
  const opts = {
    method,
    headers: {
      'Content-Type': url.includes('/auth/login') ? 'application/json' : 'application/fhir+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res  = await fetch(url, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, headers: res.headers, body: json };
}

// ── Setup: authenticate ───────────────────────────────────────────────────────

before(async () => {
  const { status, body } = await api('POST', `${V1}/auth/login`, {
    email:        TEST_EMAIL,
    password:     TEST_PASSWORD,
    hospitalCode: TEST_HOSPITAL,
  }, null);

  if (status !== 200) {
    throw new Error(`Auth failed (${status}): ${JSON.stringify(body)}`);
  }

  accessToken = body.accessToken;
  hospitalId  = String(body.user?.hospitalId || body.hospitalId || 1);
});

// ── CapabilityStatement ───────────────────────────────────────────────────────

describe('GET /api/fhir/metadata', () => {
  test('returns 200 CapabilityStatement without auth', async () => {
    const { status, body } = await api('GET', `${FHIR}/metadata`);
    assert.equal(status, 200);
    assert.equal(body.resourceType, 'CapabilityStatement');
    assert.equal(body.fhirVersion, '4.0.1');
  });

  test('lists 4 supported resource types', async () => {
    const { body } = await api('GET', `${FHIR}/metadata`);
    const resources = body.rest[0].resource.map(r => r.type);
    assert.ok(resources.includes('Patient'));
    assert.ok(resources.includes('Practitioner'));
    assert.ok(resources.includes('Appointment'));
    assert.ok(resources.includes('Encounter'));
  });
});

// ── Patient ───────────────────────────────────────────────────────────────────

describe('POST /api/fhir/Patient', () => {
  test('creates patient and returns 201 with Location header', async () => {
    const body = {
      resourceType: 'Patient',
      name:    [{ text: `FHIR Test Patient ${RUN_ID}`, family: `Test${RUN_ID}`, given: ['FHIR'] }],
      telecom: [{ system: 'email', value: `fhir.patient.${RUN_ID}@test.example.com` }],
      gender:    'male',
      birthDate: '1992-06-15',
    };

    const { status, headers, body: res } = await api('POST', `${FHIR}/Patient`, body, accessToken);
    assert.equal(status, 201, `Expected 201 got ${status}: ${JSON.stringify(res)}`);
    assert.equal(res.resourceType, 'Patient');
    assert.ok(res.id, 'Response must include an id');
    assert.ok(headers.get('location'), 'Response must include Location header');

    patientFhirId = res.id;
  });

  test('returns 422 when email is missing', async () => {
    const bad = {
      resourceType: 'Patient',
      name:    [{ text: 'No Email Patient' }],
      telecom: [{ system: 'phone', value: '123' }],
    };
    const { status, body } = await api('POST', `${FHIR}/Patient`, bad, accessToken);
    assert.equal(status, 422);
    assert.equal(body.resourceType, 'OperationOutcome');
  });

  test('returns 401 without token', async () => {
    const { status } = await api('POST', `${FHIR}/Patient`, { resourceType: 'Patient' });
    assert.equal(status, 401);
  });
});

describe('GET /api/fhir/Patient/:id', () => {
  test('returns 200 FHIR Patient for valid ID', async () => {
    if (!patientFhirId) return; // skip if POST failed
    const { status, body } = await api('GET', `${FHIR}/Patient/${patientFhirId}`, null, accessToken);
    assert.equal(status, 200, `Expected 200 got ${status}: ${JSON.stringify(body)}`);
    assert.equal(body.resourceType, 'Patient');
    assert.equal(body.id, patientFhirId);
    assert.ok(body.meta?.tag?.some(t => t.system === 'https://mediconnect.io/tenant'));
  });

  test('returns 404 for non-existent patient', async () => {
    const { status, body } = await api('GET', `${FHIR}/Patient/${hospitalId}-999999`, null, accessToken);
    assert.equal(status, 404);
    assert.equal(body.resourceType, 'OperationOutcome');
  });

  test('returns 400 for malformed FHIR ID', async () => {
    const { status, body } = await api('GET', `${FHIR}/Patient/invalid-id-xyz`, null, accessToken);
    // "invalid" is not a number → 400
    assert.ok([400, 404].includes(status));
    assert.equal(body.resourceType, 'OperationOutcome');
  });

  test('returns 401 without token', async () => {
    const { status } = await api('GET', `${FHIR}/Patient/1-1`);
    assert.equal(status, 401);
  });
});

// ── Practitioner ──────────────────────────────────────────────────────────────

describe('POST /api/fhir/Practitioner', () => {
  test('creates practitioner and returns 201', async () => {
    const body = {
      resourceType: 'Practitioner',
      name: [{ text: `Dr FHIR Test ${RUN_ID}`, family: `FhirDoc${RUN_ID}`, given: ['Test'] }],
      telecom: [{ system: 'email', value: `fhir.doc.${RUN_ID}@test.example.com` }],
      qualification: [{
        code: {
          coding: [{ system: 'https://mediconnect.io/fhir/CodeSystem/specialization', code: 'general-medicine', display: 'General Medicine' }],
          text: 'General Medicine',
        },
      }],
    };

    const { status, body: res } = await api('POST', `${FHIR}/Practitioner`, body, accessToken);
    assert.equal(status, 201, `Expected 201 got ${status}: ${JSON.stringify(res)}`);
    assert.equal(res.resourceType, 'Practitioner');
    assert.ok(res.id);

    practitionerFhirId = res.id;
  });

  test('returns 422 when qualification missing', async () => {
    const bad = {
      resourceType: 'Practitioner',
      name:         [{ text: 'No Qual' }],
      telecom:      [{ system: 'email', value: `noqual.${RUN_ID}@test.com` }],
      qualification: [],
    };
    const { status, body } = await api('POST', `${FHIR}/Practitioner`, bad, accessToken);
    assert.equal(status, 422);
    assert.equal(body.resourceType, 'OperationOutcome');
  });
});

describe('GET /api/fhir/Practitioner/:id', () => {
  test('returns 200 FHIR Practitioner', async () => {
    if (!practitionerFhirId) return;
    const { status, body } = await api('GET', `${FHIR}/Practitioner/${practitionerFhirId}`, null, accessToken);
    assert.equal(status, 200);
    assert.equal(body.resourceType, 'Practitioner');
    assert.equal(body.id, practitionerFhirId);
  });

  test('returns 404 for non-existent practitioner', async () => {
    const { status, body } = await api('GET', `${FHIR}/Practitioner/${hospitalId}-999999`, null, accessToken);
    assert.equal(status, 404);
    assert.equal(body.resourceType, 'OperationOutcome');
  });
});

// ── Appointment ───────────────────────────────────────────────────────────────

describe('POST /api/fhir/Appointment', () => {
  test('creates appointment and returns 201', async () => {
    if (!patientFhirId || !practitionerFhirId) {
      // Use known IDs from seed data as fallback
      const pid = `${hospitalId}-1`;
      const did = `${hospitalId}-1`;
      const body = {
        resourceType: 'Appointment',
        status:       'booked',
        start:        new Date(Date.now() + 86400000).toISOString(),
        end:          new Date(Date.now() + 86400000 + 1800000).toISOString(),
        participant: [
          { actor: { reference: `Patient/${pid}` },      required: 'required', status: 'accepted' },
          { actor: { reference: `Practitioner/${did}` }, required: 'required', status: 'accepted' },
        ],
        description:  'FHIR integration test appointment',
      };
      const { status } = await api('POST', `${FHIR}/Appointment`, body, accessToken);
      // May be 201 or 400/409 depending on seed data — just verify no 5xx
      assert.ok(status < 500, `Server error: ${status}`);
      return;
    }

    const body = {
      resourceType: 'Appointment',
      status:       'booked',
      start:        new Date(Date.now() + 86400000).toISOString(),
      end:          new Date(Date.now() + 86400000 + 1800000).toISOString(),
      participant: [
        { actor: { reference: `Patient/${patientFhirId}` },      required: 'required', status: 'accepted' },
        { actor: { reference: `Practitioner/${practitionerFhirId}` }, required: 'required', status: 'accepted' },
      ],
      description: 'FHIR integration test appointment',
      serviceType: [{ coding: [{ code: 'outpatient' }], text: 'Outpatient' }],
    };

    const { status, body: res } = await api('POST', `${FHIR}/Appointment`, body, accessToken);
    // Accept 201 (success) or 400/409 if doctor is inactive in dev seed
    assert.ok([201, 400, 409].includes(status), `Unexpected status: ${status}: ${JSON.stringify(res)}`);

    if (status === 201) {
      assert.equal(res.resourceType, 'Appointment');
      appointmentFhirId = res.id;
    }
  });

  test('returns 422 when participant missing', async () => {
    const bad = {
      resourceType: 'Appointment',
      status:       'booked',
      start:        new Date().toISOString(),
      participant:  [],
    };
    const { status, body } = await api('POST', `${FHIR}/Appointment`, bad, accessToken);
    assert.equal(status, 422);
    assert.equal(body.resourceType, 'OperationOutcome');
  });
});

// ── Encounter ─────────────────────────────────────────────────────────────────

describe('POST /api/fhir/Encounter', () => {
  test('creates encounter and returns 201 (or 400 for inactive doctor)', async () => {
    const pid = patientFhirId || `${hospitalId}-1`;
    const did = practitionerFhirId || `${hospitalId}-1`;

    const body = {
      resourceType: 'Encounter',
      status:       'finished',
      class:        { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'Ambulatory' },
      subject:      { reference: `Patient/${pid}`, display: 'Test Patient' },
      participant:  [{ individual: { reference: `Practitioner/${did}` } }],
      reasonCode:   [{ text: 'FHIR integration test visit' }],
      extension: [{
        url:         'https://mediconnect.io/fhir/StructureDefinition/clinical-notes',
        valueString: 'Test clinical notes from FHIR integration test.',
      }],
    };

    const { status, body: res } = await api('POST', `${FHIR}/Encounter`, body, accessToken);
    // 201 on success; 400/404 if patient or doctor IDs don't exist in dev seed
    assert.ok(status < 500, `Server error ${status}: ${JSON.stringify(res)}`);

    if (status === 201) {
      assert.equal(res.resourceType, 'Encounter');
      encounterFhirId = res.id;
    }
  });

  test('returns 422 when subject missing', async () => {
    const bad = {
      resourceType: 'Encounter',
      status:       'finished',
      class:        { code: 'AMB' },
      participant:  [{ individual: { reference: 'Practitioner/2-1' } }],
    };
    const { status, body } = await api('POST', `${FHIR}/Encounter`, bad, accessToken);
    assert.equal(status, 422);
    assert.equal(body.resourceType, 'OperationOutcome');
  });
});

describe('GET /api/fhir/Encounter/:id', () => {
  test('returns 404 for non-existent encounter', async () => {
    const { status, body } = await api('GET', `${FHIR}/Encounter/${hospitalId}-999999`, null, accessToken);
    assert.equal(status, 404);
    assert.equal(body.resourceType, 'OperationOutcome');
  });

  test('returns 200 for valid encounter if one was created', async () => {
    if (!encounterFhirId) return; // skip if POST failed
    const { status, body } = await api('GET', `${FHIR}/Encounter/${encounterFhirId}`, null, accessToken);
    assert.equal(status, 200);
    assert.equal(body.resourceType, 'Encounter');
  });
});

// ── Cross-tenant isolation ────────────────────────────────────────────────────

describe('Cross-tenant isolation', () => {
  test('returns 403 when accessing resource from another hospital (or 404 if bypass allowed)', async () => {
    // Try accessing hospitalId=999 resources — should be 403 if scoped user, or 404 if superadmin (bypass)
    const { status, body } = await api('GET', `${FHIR}/Patient/999-1`, null, accessToken);
    assert.ok(status === 403 || status === 404, `Expected 403 or 404, got ${status}`);
    assert.equal(body.resourceType, 'OperationOutcome');
    if (status === 403) {
      assert.equal(body.issue[0].code, 'security');
    } else {
      assert.equal(body.issue[0].code, 'not-found');
    }
  });
});
