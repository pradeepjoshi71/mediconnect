'use strict';

const db = require('../config/db');
const http = require('http');
const crypto = require('crypto');
const ioredis = require('ioredis');

async function run() {
  console.log('====================================================');
  console.log('       MEDICONNECT QA INVESTIGATION REPORT         ');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. REPRODUCE ADMIN LOGIN FAILURE
  // ----------------------------------------------------
  console.log('▶ [CHECK 1] Reproducing Admin Login Failure...');
  const emailsToTest = ['admin@mediconnect.local', 'superadmin@mediconnect.local'];
  for (const email of emailsToTest) {
    try {
      const payload = JSON.stringify({
        email,
        password: 'Password@123',
        hospitalCode: 'MCH-BLR'
      });
      const reqOpts = {
        hostname: '127.0.0.1',
        port: 5000,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const result = await new Promise((resolve, reject) => {
        const req = http.request(reqOpts, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
      });

      console.log(`   Email: ${email} -> HTTP Status: ${result.status}, Body: ${result.body}`);
    } catch (err) {
      console.log(`   Email: ${email} -> Error: ${err.message}`);
    }
  }

  // ----------------------------------------------------
  // 2. CHECK TENANT RESOLUTION & ADMIN USER ROWS
  // ----------------------------------------------------
  console.log('\n▶ [CHECK 2] Inspecting Admin User Rows & Tenant Association in DB...');
  const adminUsers = await db.query(`
    SELECT u.id, u.email, u.hospital_id, h.code AS hospital_code, r.code AS role_code, u.status, u.password_hash, u.failed_login_attempts, u.locked_until_at
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN hospitals h ON h.id = u.hospital_id
    WHERE r.code IN ('admin', 'super_admin') OR u.email LIKE '%admin%'
  `);
  console.log(`   Found ${adminUsers.rows.length} admin user row(s):`);
  console.dir(adminUsers.rows, { depth: null });

  const hospitals = await db.query(`SELECT id, code, name FROM hospitals`);
  console.log(`   Registered Hospitals in DB (${hospitals.rows.length}):`);
  console.dir(hospitals.rows, { depth: null });

  // ----------------------------------------------------
  // 3. CHECK PGBOUNCER / DB TRANSACTION SESSION STATES
  // ----------------------------------------------------
  console.log('\n▶ [CHECK 3] Checking DB Connection / PgBouncer Session state behavior...');
  console.log(`   PGBOUNCER_HOST: ${process.env.PGBOUNCER_HOST || 'not set'}, PGBOUNCER_PORT: ${process.env.PGBOUNCER_PORT || 'not set'}`);
  console.log(`   DB_HOST: ${process.env.DB_HOST}, DB_PORT: ${process.env.DB_PORT}`);

  // Test set session timezone check in pool connect hook
  try {
    const testQuery = await db.query(`SHOW timezone;`);
    console.log(`   Current connection timezone: ${testQuery.rows[0]?.TimeZone || testQuery.rows[0]?.timezone}`);
  } catch (e) {
    console.log(`   PgBouncer SET check error: ${e.message}`);
  }

  // ----------------------------------------------------
  // 4. CHECK RATE LIMITER IN REDIS
  // ----------------------------------------------------
  console.log('\n▶ [CHECK 4] Checking Redis Rate Limiter Keys...');
  try {
    const redis = new ioredis({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT || 6379),
      password: process.env.REDIS_PASSWORD || undefined,
    });
    const keys = await redis.keys('*rate*');
    console.log(`   Found ${keys.length} rate limiter key(s) in Redis:`);
    for (const key of keys) {
      const val = await redis.get(key);
      const ttl = await redis.ttl(key);
      console.log(`     Key: ${key} = ${val} (TTL: ${ttl}s)`);
    }
    await redis.quit();
  } catch (err) {
    console.log(`   Redis check error: ${err.message}`);
  }

  // ----------------------------------------------------
  // 5. CHECK JWT SECRET CONSISTENCY
  // ----------------------------------------------------
  console.log('\n▶ [CHECK 5] Checking JWT Secret Consistency...');
  const jwtSecret = process.env.JWT_SECRET || '';
  const hash = crypto.createHash('sha256').update(jwtSecret).digest('hex');
  console.log(`   JWT_SECRET Hash (SHA-256): ${hash}`);

  // ----------------------------------------------------
  // 6. CHECK RBAC ROLES & PERMISSIONS
  // ----------------------------------------------------
  console.log('\n▶ [CHECK 6] Inspecting RBAC Roles & Permissions...');
  const roles = await db.query(`SELECT id, code, name FROM roles ORDER BY id`);
  console.log(`   Roles (${roles.rows.length}):`, roles.rows.map(r => `${r.id}:${r.code}`));

  const adminPerms = await db.query(`
    SELECT r.code AS role, p.code AS permission
    FROM role_permissions rp
    JOIN roles r ON r.id = rp.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE r.code IN ('admin', 'super_admin')
    ORDER BY r.code, p.code
  `);
  console.log(`   Admin Role Permissions count: ${adminPerms.rows.length}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Fatal investigation error:', err);
  process.exit(1);
});
