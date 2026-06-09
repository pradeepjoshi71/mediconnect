/**
 * insuranceRepository.test.js — Unit tests for the Insurance Claims Repository.
 *
 * Run: node --test backend/src/insurance/tests/insuranceRepository.test.js
 */
'use strict';

const { test, describe, before, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const db = require('../../config/db');
const insuranceRepository = require('../repository/insuranceRepository');

// Simple mock helper to mock db.query
let mockQueries = [];
let mockResult = { rows: [] };
const originalQuery = db.query;

before(() => {
  db.query = async (text, params) => {
    mockQueries.push({ text, params });
    return mockResult;
  };
});

afterEach(() => {
  mockQueries = [];
  mockResult = { rows: [] };
});

describe('Insurance Repository Unit Tests', () => {
  describe('Providers', () => {
    test('createProvider executes correct query and returns mapped row', async () => {
      mockResult = {
        rows: [{
          id: 1,
          hospitalId: 2,
          name: 'Star Health',
          code: 'STAR-HEALTH',
          contactEmail: 'contact@star.com',
          contactPhone: '1234567890',
          portalUrl: 'https://star.com',
          thaRate: 95.00,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }]
      };

      const res = await insuranceRepository.createProvider({
        hospitalId: 2,
        name: 'Star Health',
        code: 'STAR-HEALTH',
        contactEmail: 'contact@star.com',
        contactPhone: '1234567890',
        portalUrl: 'https://star.com',
        thaRate: 95.00,
        isActive: true
      });

      assert.equal(mockQueries.length, 1);
      assert.match(mockQueries[0].text, /INSERT INTO insurance_providers/);
      assert.deepEqual(mockQueries[0].params, [
        2, 'Star Health', 'STAR-HEALTH', 'contact@star.com', '1234567890', 'https://star.com', 95.00, true
      ]);
      assert.equal(res.id, 1);
      assert.equal(res.code, 'STAR-HEALTH');
      assert.equal(res.thaRate, 95.00);
    });

    test('getProviderByCode queries correct condition', async () => {
      mockResult = {
        rows: [{
          id: 1,
          hospitalId: 2,
          name: 'Star Health',
          code: 'STAR-HEALTH'
        }]
      };

      const res = await insuranceRepository.getProviderByCode('STAR-HEALTH', 2);
      assert.equal(mockQueries.length, 1);
      assert.match(mockQueries[0].text, /SELECT[\s\S]*FROM insurance_providers[\s\S]*WHERE code = \$1 AND hospital_id = \$2/);
      assert.deepEqual(mockQueries[0].params, ['STAR-HEALTH', 2]);
      assert.equal(res.code, 'STAR-HEALTH');
    });
  });

  describe('Policies', () => {
    test('createPolicy queries policy table and does follow-up select', async () => {
      mockResult = {
        rows: [{
          id: 10,
          hospitalId: 2,
          policyNumber: 'POL-123',
          patientId: 5,
          providerId: 1,
          providerName: 'Star Health',
          patientName: 'John Doe'
        }]
      };

      const res = await insuranceRepository.createPolicy({
        hospitalId: 2,
        patientId: 5,
        providerId: 1,
        policyNumber: 'POL-123',
        effectiveDate: '2026-01-01',
        expiryDate: '2027-01-01',
        status: 'active'
      });

      // It should call INSERT first, then getPolicyById SELECT (which is mocked to return the row)
      assert.ok(mockQueries.length >= 1);
      assert.match(mockQueries[0].text, /INSERT INTO insurance_policies/);
      assert.equal(res.id, 10);
      assert.equal(res.policyNumber, 'POL-123');
    });
  });

  describe('Claims', () => {
    test('createClaim queries claims table', async () => {
      mockResult = {
        rows: [{
          id: 100,
          hospitalId: 2,
          claimNumber: 'CLM-001',
          policyId: 10,
          patientId: 5,
          invoiceId: 20,
          claimedAmountCents: 5000,
          status: 'submitted',
          patientName: 'John Doe',
          policyNumber: 'POL-123',
          providerName: 'Star Health',
          invoiceNumber: 'INV-001'
        }]
      };

      const res = await insuranceRepository.createClaim({
        hospitalId: 2,
        claimNumber: 'CLM-001',
        policyId: 10,
        patientId: 5,
        invoiceId: 20,
        claimedAmountCents: 5000,
        status: 'submitted',
        notes: 'Test claim'
      });

      assert.ok(mockQueries.length >= 1);
      assert.match(mockQueries[0].text, /INSERT INTO insurance_claims/);
      assert.equal(res.id, 100);
      assert.equal(res.claimNumber, 'CLM-001');
    });
  });

  describe('Documents', () => {
    test('createDocument and getDocumentById work as expected', async () => {
      mockResult = {
        rows: [{
          id: 50,
          hospitalId: 2,
          claimId: 100,
          uploadedBy: 4,
          uploadedByName: 'Admin User',
          documentType: 'bill',
          originalName: 'bill.pdf',
          objectKey: '2/100/bill.pdf',
          mimeType: 'application/pdf',
          byteSize: 1024
        }]
      };

      const res = await insuranceRepository.createDocument({
        hospitalId: 2,
        claimId: 100,
        uploadedBy: 4,
        documentType: 'bill',
        originalName: 'bill.pdf',
        objectKey: '2/100/bill.pdf',
        mimeType: 'application/pdf',
        byteSize: 1024
      });

      assert.ok(mockQueries.length >= 1);
      assert.match(mockQueries[0].text, /INSERT INTO claim_documents/);
      assert.equal(res.id, 50);
      assert.equal(res.documentType, 'bill');
    });
  });
});
