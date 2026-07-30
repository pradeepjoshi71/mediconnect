'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createTenantRateLimiter, tenantIpKeyGenerator } = require('../middlewares/rateLimiter');
const partitionMaintenance = require('../jobs/partitionMaintenance');
const auditRepository = require('../repositories/auditRepository');
const db = require('../config/db');

test('Rate Limiter — Key Generator & 429 Retry-After Header', async (t) => {
  await t.test('Key generator extracts IP and tenant ID correctly', () => {
    const mockReq1 = {
      ip: '192.168.1.10',
      user: { hospitalId: 42 },
    };
    assert.equal(tenantIpKeyGenerator(mockReq1), '192.168.1.10:42');

    const mockReq2 = {
      headers: { 'x-forwarded-for': '10.0.0.1, 127.0.0.1', 'x-hospital-code': 'MCH-BLR' },
    };
    assert.equal(tenantIpKeyGenerator(mockReq2), '10.0.0.1:MCH-BLR');
  });

  await t.test('Middleware sends 429 with Retry-After header when limit exceeded', async () => {
    const limiter = createTenantRateLimiter({ limit: 1, windowMs: 10 * 1000 });
    const req = { ip: '127.0.0.99', headers: {} };
    let statusCode = 200;
    let headers = {};
    let responseBody = null;

    const res = {
      setHeader(name, val) {
        headers[name] = val;
      },
      status(code) {
        statusCode = code;
        return this;
      },
      json(body) {
        responseBody = body;
        return this;
      },
    };

    // First request - pass
    await new Promise((resolve) => limiter(req, res, resolve));

    // Second request - rate limited (429)
    await new Promise((resolve) => limiter(req, res, resolve));

    assert.equal(statusCode, 429);
    assert.equal(headers['Retry-After'], '10');
    assert.equal(responseBody.error, 'Too Many Requests');
  });
});

test('Audit Logs Native Partitioning & Repository Queries', async (t) => {
  await t.test('Database query verifies audit_logs is a partitioned table', async () => {
    const res = await db.query(`
      SELECT c.relkind
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = 'audit_logs'
    `);
    assert.equal(res.rows.length, 1);
    assert.equal(res.rows[0].relkind, 'p', 'audit_logs must be a partitioned table (relkind = p)');
  });

  await t.test('createAuditLog & listAuditLogs operate seamlessly without query logic changes', async () => {
    const newLog = await auditRepository.createAuditLog({
      hospitalId: 1,
      userId: 1,
      actorRole: 'admin',
      action: 'SCALING_TEST_ACTION',
      entityType: 'SystemConfig',
      entityId: 'cluster-node-1',
      requestId: 'req-scaling-test-100',
      ipAddress: '127.0.0.1',
      userAgent: 'scaling-test-agent',
      metadata: { test: true },
    });

    assert.ok(newLog.id);
    assert.equal(newLog.action, 'SCALING_TEST_ACTION');

    const logs = await auditRepository.listAuditLogs({
      hospitalId: 1,
      action: 'SCALING_TEST_ACTION',
      limit: 10,
    });

    assert.ok(logs.length > 0);
    assert.equal(logs[0].action, 'SCALING_TEST_ACTION');
  });

  await t.test('partitionMaintenance job creates month partitions automatically', async () => {
    const futureDate = new Date(2028, 5, 15);
    const createdPart = await partitionMaintenance.ensureMonthPartition(futureDate);
    assert.equal(createdPart, 'audit_logs_y2028m06');

    const checkDb = await db.query(`
      SELECT 1 FROM pg_class WHERE relname = 'audit_logs_y2028m06'
    `);
    assert.equal(checkDb.rows.length, 1, 'Future month partition audit_logs_y2028m06 must exist in database');
  });
});
