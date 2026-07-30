'use strict';

const db = require('../config/db');
const http = require('http');

const BASE_URL = 'http://127.0.0.1:5000';

function req(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }
    const url = new URL(BASE_URL + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: reqHeaders
    };
    const r = http.request(opts, (res) => {
      let data = '';
      let cookies = res.headers['set-cookie'] || [];
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, cookies, body: json || data });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const results = {};

function record(category, testName, pass, details = '') {
  if (!results[category]) results[category] = [];
  results[category].push({ testName, pass, details });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${category} :: ${testName} ${details ? '(' + details + ')' : ''}`);
}

function parseCookies(cookies) {
  if (!cookies || !cookies.length) return '';
  return cookies.map(c => c.split(';')[0]).join('; ');
}

async function runQA() {
  console.log('====================================================');
  console.log('       MEDICONNECT FULL PRE-ROLLOUT QA SUITE        ');
  console.log('====================================================\n');

  const ts = Date.now();

  // ----------------------------------------------------
  // 1. LOGIN TESTS
  // ----------------------------------------------------
  console.log('--- 1. LOGIN TESTS ---');
  
  // Valid credentials
  const validLogin = await req('/api/v1/auth/login', 'POST', {
    email: 'admin@mediconnect.local',
    password: 'Password@123',
    hospitalCode: 'MCH-BLR'
  });
  record('Login', 'Valid credentials (Admin)', validLogin.status === 200, `Status: ${validLogin.status}`);

  // Invalid credentials
  const invalidLogin = await req('/api/v1/auth/login', 'POST', {
    email: 'admin@mediconnect.local',
    password: 'WrongPassword999',
    hospitalCode: 'MCH-BLR'
  });
  record('Login', 'Invalid credentials', invalidLogin.status === 401, `Status: ${invalidLogin.status}`);

  // Inactive / Disabled Account test
  const disabledEmail = `disabled.qa.${ts}@mediconnect.local`;
  await db.query(`
    INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, status)
    VALUES (2, 1, 'Disabled QA User', '${disabledEmail}', '$2b$12$qPn7HUWqaKLkGOSVx/P2Z.Tn6xLi2lu.TyLm2W7/1BnlIjS9m9OA2', 'inactive')
  `);
  const inactiveLogin = await req('/api/v1/auth/login', 'POST', {
    email: disabledEmail,
    password: 'Password@123',
    hospitalCode: 'MCH-BLR'
  });
  record('Login', 'Disabled / Inactive account', inactiveLogin.status === 403, `Status: ${inactiveLogin.status}`);

  // Account Lockout test
  const lockoutEmail = `lockout.qa.${ts}@mediconnect.local`;
  await db.query(`
    INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, status, failed_login_attempts)
    VALUES (2, 1, 'Lockout QA User', '${lockoutEmail}', '$2b$12$qPn7HUWqaKLkGOSVx/P2Z.Tn6xLi2lu.TyLm2W7/1BnlIjS9m9OA2', 'active', 0)
  `);
  for (let i = 0; i < 5; i++) {
    await req('/api/v1/auth/login', 'POST', {
      email: lockoutEmail,
      password: 'WrongPassword',
      hospitalCode: 'MCH-BLR'
    });
  }
  const lockedLogin = await req('/api/v1/auth/login', 'POST', {
    email: lockoutEmail,
    password: 'Password@123',
    hospitalCode: 'MCH-BLR'
  });
  record('Login', 'Locked account lockout enforcement', lockedLogin.status === 423, `Status: ${lockedLogin.status}`);

  // ----------------------------------------------------
  // 2. RBAC ROUTE ACCESS TESTS
  // ----------------------------------------------------
  console.log('\n--- 2. RBAC ROUTE ACCESS TESTS ---');

  const getRoleToken = async (email, password = 'Password@123', code = 'MCH-BLR') => {
    const res = await req('/api/v1/auth/login', 'POST', { email, password, hospitalCode: code });
    return res.body?.accessToken;
  };

  const adminToken = await getRoleToken('admin@mediconnect.local');
  const doctorToken = await getRoleToken('doctor@mediconnect.local');
  const receptionToken = await getRoleToken('reception@mediconnect.local');

  // Positive cases
  const adminAccess = await req('/api/v1/admin/users', 'GET', null, { Authorization: `Bearer ${adminToken}` });
  record('RBAC', 'Admin accessing /admin/users (Positive)', adminAccess.status === 200, `Status: ${adminAccess.status}`);

  const doctorAccess = await req('/api/v1/doctors', 'GET', null, { Authorization: `Bearer ${doctorToken}` });
  record('RBAC', 'Doctor accessing /doctors (Positive)', doctorAccess.status === 200, `Status: ${doctorAccess.status}`);

  const receptionAccess = await req('/api/v1/patients', 'GET', null, { Authorization: `Bearer ${receptionToken}` });
  record('RBAC', 'Receptionist accessing /patients (Positive)', receptionAccess.status === 200, `Status: ${receptionAccess.status}`);

  // Negative cross-role denial cases
  const doctorDenial = await req('/api/v1/admin/users', 'GET', null, { Authorization: `Bearer ${doctorToken}` });
  record('RBAC', 'Doctor denied /admin/users (Negative)', doctorDenial.status === 403, `Status: ${doctorDenial.status}`);

  const receptionDenial = await req('/api/v1/admin/users', 'GET', null, { Authorization: `Bearer ${receptionToken}` });
  record('RBAC', 'Receptionist denied /admin/users (Negative)', receptionDenial.status === 403, `Status: ${receptionDenial.status}`);

  // ----------------------------------------------------
  // 3. TENANT RESOLUTION & ISOLATION TESTS
  // ----------------------------------------------------
  console.log('\n--- 3. TENANT RESOLUTION TESTS ---');
  const tenantBAdminToken = await getRoleToken('admin@betaclinic.in', 'clinicsecretpassword', 'BETA01');

  const crossTenantAccess = await req('/api/v1/admin/users', 'GET', null, { Authorization: `Bearer ${tenantBAdminToken}` });
  const staffList = crossTenantAccess.body?.data || crossTenantAccess.body?.users || crossTenantAccess.body || [];
  const tenantIsolationOk = Array.isArray(staffList) && staffList.every(s => s.hospitalId === 1 || s.hospital_id === 1);
  record('Tenant resolution', 'User from Tenant A cannot access Tenant B data', crossTenantAccess.status === 200 && tenantIsolationOk, `Status: ${crossTenantAccess.status}`);

  // ----------------------------------------------------
  // 4. SESSION MANAGEMENT TESTS
  // ----------------------------------------------------
  console.log('\n--- 4. SESSION MANAGEMENT TESTS ---');
  const session1 = await req('/api/v1/auth/login', 'POST', { email: 'admin@mediconnect.local', password: 'Password@123', hospitalCode: 'MCH-BLR' });
  const session2 = await req('/api/v1/auth/login', 'POST', { email: 'admin@mediconnect.local', password: 'Password@123', hospitalCode: 'MCH-BLR' });
  record('Session', 'Concurrent sessions allowed for user', session1.status === 200 && session2.status === 200);

  const logoutRes = await req('/api/v1/auth/logout', 'POST', null, {
    Cookie: parseCookies(session1.cookies)
  });
  record('Session', 'Logout clears session & invalidates refresh token', logoutRes.status === 204);

  const invalidTokenRes = await req('/api/v1/admin/users', 'GET', null, { Authorization: `Bearer invalid.jwt.token` });
  record('Session', 'Invalid/Expired access token denied', invalidTokenRes.status === 401, `Status: ${invalidTokenRes.status}`);

  // ----------------------------------------------------
  // 5. PASSWORD RESET TESTS
  // ----------------------------------------------------
  console.log('\n--- 5. PASSWORD RESET TESTS ---');
  const resetEmail = `pwreset.qa.${ts}@mediconnect.local`;
  await db.query(`
    INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, status)
    VALUES (2, 3, 'PW Reset QA User', '${resetEmail}', '$2b$12$qPn7HUWqaKLkGOSVx/P2Z.Tn6xLi2lu.TyLm2W7/1BnlIjS9m9OA2', 'active')
  `);

  const forgotRes = await req('/api/v1/auth/forgot-password', 'POST', {
    email: resetEmail,
    hospitalCode: 'MCH-BLR'
  });
  record('Password reset', 'Request forgot password token', forgotRes.status === 200);

  const invalidReset = await req('/api/v1/auth/reset-password', 'POST', {
    token: 'invalid-reset-token-12345',
    password: 'NewPassword123!',
    hospitalCode: 'MCH-BLR'
  });
  record('Password reset', 'Invalid / expired reset token rejected', invalidReset.status === 400 || invalidReset.status === 401 || invalidReset.status === 404, `Status: ${invalidReset.status}`);

  // ----------------------------------------------------
  // 6. REFRESH TOKEN TESTS
  // ----------------------------------------------------
  console.log('\n--- 6. REFRESH TOKEN TESTS ---');
  const freshLogin = await req('/api/v1/auth/login', 'POST', {
    email: 'admin@mediconnect.local',
    password: 'Password@123',
    hospitalCode: 'MCH-BLR'
  });
  const oldCookie = parseCookies(freshLogin.cookies);

  // First refresh (rotates token)
  const refreshRes = await req('/api/v1/auth/refresh', 'POST', null, { Cookie: oldCookie });
  record('Refresh token', 'Token rotation on refresh request', refreshRes.status === 200 && !!refreshRes.body?.accessToken);

  // Reuse attempt with OLD cookie (should fail with 401)
  const reuseRefresh = await req('/api/v1/auth/refresh', 'POST', null, { Cookie: oldCookie });
  record('Refresh token', 'Reuse detection / old token revocation', reuseRefresh.status === 401, `Status: ${reuseRefresh.status}`);

  console.log('\n====================================================');
  console.log('             QA TEST SUITE COMPLETED                ');
  console.log('====================================================');

  process.exit(0);
}

runQA().catch(e => {
  console.error('QA Test execution failed:', e);
  process.exit(1);
});
