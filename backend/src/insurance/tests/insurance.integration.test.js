/**
 * insurance.integration.test.js — E2E integration tests for Insurance Claims Module.
 *
 * Tests run against the live dev server (http://localhost:5000).
 * The server must be running and seeded before executing these tests.
 *
 * Run: node --test backend/src/insurance/tests/insurance.integration.test.js
 */
'use strict';

const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.TEST_BASE_URL || 'http://localhost:5000';
const V1 = `${BASE}/api/v1`;

const TEST_EMAIL = process.env.TEST_EMAIL || 'superadmin@mediconnect.local';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Password@123';
const TEST_HOSPITAL = process.env.TEST_HOSPITAL || 'MCH-BLR';

let accessToken = '';
let hospitalId = 0;
let patientId = 0;
let invoiceId = null;
let providerId = 0;
let policyId = 0;
let claimId = 0;
let claimNumber = '';
let docId = 0;

const RUN_ID = Date.now();

// --- Helper for API calls ---
async function api(method, endpoint, body, token, isMultipart = false) {
  const headers = {};
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const opts = {
    method,
    headers,
    ...(body ? { body: isMultipart ? body : JSON.stringify(body) } : {})
  };

  const res = await fetch(`${V1}${endpoint}`, opts);
  let json;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return { status: res.status, headers: res.headers, body: json };
}

// --- Setup ---
before(async () => {
  // Login
  const { status, body } = await api('POST', '/auth/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    hospitalCode: TEST_HOSPITAL
  });

  if (status !== 200) {
    throw new Error(`Authentication failed during integration test setup: ${JSON.stringify(body)}`);
  }

  accessToken = body.accessToken;
  hospitalId = body.user?.hospitalId || body.hospitalId;

  // Retrieve a patient ID to link to policies/claims
  const patientsRes = await api('GET', '/patients', null, accessToken);
  assert.equal(patientsRes.status, 200);
  const patientsList = patientsRes.body.patients || patientsRes.body;
  if (patientsList && patientsList.length > 0) {
    patientId = patientsList[0].patient_id || patientsList[0].id;
  } else {
    throw new Error('No patient found in database to link for integration tests.');
  }

  // Create a new pending invoice to guarantee it has an outstanding balance
  const invoiceRes = await api('POST', '/invoices', {
    patientId,
    subtotal: 100.00,
    taxAmount: 0.00,
    discountAmount: 0.00,
    status: 'pending',
    items: [
      {
        itemType: 'consultation',
        itemName: 'Integration Test Fee',
        quantity: 1,
        unitPrice: 100.00,
        totalPrice: 100.00
      }
    ]
  }, accessToken);

  if (invoiceRes.status === 201) {
    invoiceId = invoiceRes.body.id;
  } else {
    // Fallback: list invoices
    const invoicesRes = await api('GET', '/invoices', null, accessToken);
    if (invoicesRes.status === 200) {
      const invoicesList = invoicesRes.body.invoices || invoicesRes.body;
      const pendingInv = (invoicesList || []).find(i => i.status === 'pending');
      if (pendingInv) {
        invoiceId = pendingInv.id;
      }
    }
  }
});

// --- Tests ---
describe('Insurance Claims Module Integration Tests', () => {
  
  describe('Insurance Provider Master', () => {
    test('POST /providers creates a new insurance provider', async () => {
      const payload = {
        name: `Integration Test Provider ${RUN_ID}`,
        code: `PROV-${RUN_ID}`,
        contactEmail: 'claims@testprovider.com',
        contactPhone: '+91-9999988888',
        portalUrl: 'https://testprovider.com',
        thaRate: 90.00
      };

      const { status, body } = await api('POST', '/insurance/providers', payload, accessToken);
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.id);
      assert.equal(body.code, `PROV-${RUN_ID}`);
      assert.equal(body.thaRate, 90.00);

      providerId = body.id;
    });

    test('POST /providers fails with duplicate code', async () => {
      const payload = {
        name: `Another Provider ${RUN_ID}`,
        code: `PROV-${RUN_ID}`, // duplicate code
        thaRate: 100.00
      };

      const { status } = await api('POST', '/insurance/providers', payload, accessToken);
      assert.equal(status, 409);
    });

    test('GET /providers lists created providers', async () => {
      const { status, body } = await api('GET', '/insurance/providers', null, accessToken);
      assert.equal(status, 200);
      assert.ok(Array.isArray(body));
      const found = body.find(p => p.id === providerId);
      assert.ok(found);
      assert.equal(found.name, `Integration Test Provider ${RUN_ID}`);
    });
  });

  describe('Policy Management', () => {
    test('POST /policies creates a new policy linked to patient', async () => {
      const payload = {
        patientId,
        providerId,
        policyNumber: `POL-${RUN_ID}`,
        planName: 'Gold Super Health Plan',
        coverageType: 'individual',
        coverageAmountCents: 500000, // INR 5000.00
        deductibleCents: 5000,
        coPayPercent: 10.00,
        effectiveDate: '2026-01-01',
        expiryDate: '2027-12-31',
        status: 'active'
      };

      const { status, body } = await api('POST', '/insurance/policies', payload, accessToken);
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.id);
      assert.equal(body.policyNumber, `POL-${RUN_ID}`);
      assert.equal(body.patientId, patientId);

      policyId = body.id;
    });

    test('GET /policies lists the created policy', async () => {
      const { status, body } = await api('GET', `/insurance/policies?patientId=${patientId}`, null, accessToken);
      assert.equal(status, 200);
      const found = body.find(p => p.id === policyId);
      assert.ok(found);
      assert.equal(found.policyNumber, `POL-${RUN_ID}`);
    });
  });

  describe('Claim Submission', () => {
    test('POST /claims submits new claim', async () => {
      const payload = {
        policyId,
        patientId,
        invoiceId, // might be null
        claimedAmountCents: 10000, // INR 100.00
        notes: 'Integration test claim notes'
      };

      const { status, body } = await api('POST', '/insurance/claims', payload, accessToken);
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.id);
      assert.ok(body.claimNumber);
      assert.equal(body.status, 'submitted');

      claimId = body.id;
      claimNumber = body.claimNumber;
    });

    test('POST /claims fails duplicate claim if invoice linked', async () => {
      if (!invoiceId) return; // skip if no invoice linked

      const payload = {
        policyId,
        patientId,
        invoiceId,
        claimedAmountCents: 10000
      };

      const { status } = await api('POST', '/insurance/claims', payload, accessToken);
      assert.equal(status, 409);
    });
  });

  describe('Claim Tracking & Status Lifecycle', () => {
    test('GET /claims/:id retrieves claim details', async () => {
      const { status, body } = await api('GET', `/insurance/claims/${claimId}`, null, accessToken);
      assert.equal(status, 200);
      assert.equal(body.id, claimId);
      assert.equal(body.claimNumber, claimNumber);
    });

    test('PUT /claims/:id/status transitions to under_review', async () => {
      const payload = { status: 'under_review' };
      const { status, body } = await api('PUT', `/insurance/claims/${claimId}/status`, payload, accessToken);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.status, 'under_review');
    });

    test('PUT /claims/:id/status transition failure checks', async () => {
      // try invalid transition (under_review -> submitted)
      const payload = { status: 'submitted' };
      const { status } = await api('PUT', `/insurance/claims/${claimId}/status`, payload, accessToken);
      assert.equal(status, 409);
    });

    test('PUT /claims/:id/status transitions to approved', async () => {
      const payload = {
        status: 'approved',
        approvedAmountCents: 8000 // INR 80.00 approved out of INR 100.00 claimed
      };
      const { status, body } = await api('PUT', `/insurance/claims/${claimId}/status`, payload, accessToken);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.status, 'approved');
      assert.equal(body.approvedAmountCents, 8000);
    });
  });

  describe('Claim Document Management in MinIO', () => {
    test('POST /claims/:id/documents uploads file buffer to MinIO', async () => {
      // Create multipart FormData
      const formData = new FormData();
      const blob = new Blob(['mock file content'], { type: 'application/pdf' });
      formData.append('file', blob, 'claim-receipt.pdf');
      formData.append('documentType', 'bill');

      const { status, body } = await api('POST', `/insurance/claims/${claimId}/documents`, formData, accessToken, true);
      assert.equal(status, 201, JSON.stringify(body));
      assert.ok(body.id);
      assert.equal(body.originalName, 'claim-receipt.pdf');
      assert.equal(body.documentType, 'bill');

      docId = body.id;
    });

    test('GET /claims/:id/documents lists the uploaded documents', async () => {
      const { status, body } = await api('GET', `/insurance/claims/${claimId}/documents`, null, accessToken);
      assert.equal(status, 200);
      assert.ok(Array.isArray(body));
      const found = body.find(d => d.id === docId);
      assert.ok(found);
    });

    test('GET /claims/:id/documents/:docId/url generates presigned download URL', async () => {
      const { status, body } = await api('GET', `/insurance/claims/${claimId}/documents/${docId}/url`, null, accessToken);
      assert.equal(status, 200);
      assert.ok(body.url);
      assert.match(body.url, /^http/);
    });

    test('DELETE /claims/:id/documents/:docId deletes document successfully', async () => {
      const { status, body } = await api('DELETE', `/insurance/claims/${claimId}/documents/${docId}`, null, accessToken);
      assert.equal(status, 200);
      assert.equal(body.success, true);
    });
  });

  describe('Settlement Recording', () => {
    test('PUT /claims/:id/settle processes settlement and links to billing', async () => {
      const payload = {
        settlementAmountCents: 8000, // INR 80.00
        settlementReference: `SETTLE-REF-${RUN_ID}`,
        paymentMethod: 'Bank Transfer',
        notes: 'Final settlement via bank wire transfer'
      };

      const { status, body } = await api('PUT', `/insurance/claims/${claimId}/settle`, payload, accessToken);
      assert.equal(status, 200, JSON.stringify(body));
      assert.equal(body.status, 'settled');
      assert.equal(body.settlementAmountCents, 8000);
      assert.equal(body.settlementReference, `SETTLE-REF-${RUN_ID}`);
    });
  });

  describe('Deactivate Providers', () => {
    test('DELETE /providers/:id soft-deletes the provider', async () => {
      const { status, body } = await api('DELETE', `/insurance/providers/${providerId}`, null, accessToken);
      assert.equal(status, 200);
      assert.equal(body.success, true);
    });
  });
});
