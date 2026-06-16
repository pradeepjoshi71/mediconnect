/**
 * RBAC Phase 6 HTTP Smoke Test
 * Tests the new role permissions via the live backend API (no direct DB connection).
 * Requires the backend to be running at http://localhost:5000
 * Uses existing seeded users + creates test staff via /api/v1/admin/staff endpoint.
 */

const http = require('http');
const BASE_URL = 'http://localhost:5000';

// ─── Helpers ───────────────────────────────────────────────────────────────────

function apiRequest(path, method = 'GET', token = null, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const url = new URL(BASE_URL + path);
    const options = { hostname: url.hostname, port: url.port || 80, path: url.pathname + url.search, method, headers };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function login(email, password, hospitalCode = 'MCH-BLR') {
  const res = await apiRequest('/api/v1/auth/login', 'POST', null, { email, password, hospitalCode });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${JSON.stringify(res.body)}`);
  return res.body.accessToken;
}

let PASS = 0, FAIL = 0;

function check(label, actual, expected) {
  const ok = expected === 'not_403' ? actual !== 403 : actual === expected;
  const icon = ok ? '✅' : '❌';
  console.log(`  ${icon} ${label}: got ${actual} (expected ${expected === 'not_403' ? '!= 403' : expected})`);
  if (ok) PASS++; else FAIL++;
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

async function run() {
  console.log('=== RBAC Phase 6 HTTP Smoke Test ===\n');

  // 1. Get admin token to create staff users
  console.log('▶ Logging in as admin...');
  const adminToken = await login('admin@mediconnect.local', 'Password@123');
  const timestamp = Date.now();

  // 2. Create specialist role users via admin API
  const rolesToTest = [
    { role: 'billing_admin', label: 'billing_admin' },
    { role: 'lab_admin',     label: 'lab_admin' },
    { role: 'report_admin',  label: 'report_admin' },
    { role: 'patient_manager', label: 'patient_manager' },
    { role: 'inventory_admin', label: 'inventory_admin' },
  ];

  const tokens = {};

  console.log('\n▶ Creating test staff users...');
  for (const { role, label } of rolesToTest) {
    const email = `rbac.${role}.${timestamp}@mediconnect.local`;
    const createRes = await apiRequest('/api/v1/admin/staff', 'POST', adminToken, {
      fullName: `Test ${label}`,
      email,
      password: 'Password@123',
      role,
      phone: '+91-9000000099',
    });
    if (createRes.status === 201 || createRes.status === 200) {
      console.log(`  ✅ Created ${label} user: ${email}`);
      try {
        tokens[role] = await login(email, 'Password@123');
      } catch (e) {
        console.log(`  ⚠️  Could not log in as ${label}: ${e.message}`);
      }
    } else {
      console.log(`  ⚠️  Could not create ${label} (${createRes.status}): ${JSON.stringify(createRes.body)}`);
    }
  }

  // Also grab seeded role tokens
  console.log('\n▶ Logging in as seeded roles...');
  const doctorToken = await login('doctor@mediconnect.local', 'Password@123');
  const patientToken = await login('patient@mediconnect.local', 'Password@123');
  const receptionToken = await login('reception@mediconnect.local', 'Password@123');
  console.log('  ✅ doctor, patient, receptionist tokens acquired');

  // ─── billing_admin ────────────────────────────────────────────────────────
  if (tokens['billing_admin']) {
    console.log('\n▶ Testing billing_admin permissions:');
    const bt = tokens['billing_admin'];
    check('GET /payments/history (record_payments)',       (await apiRequest('/api/v1/payments/history', 'GET', bt)).status, 200);
    check('GET /api/v1/analytics (view_analytics)',        (await apiRequest('/api/v1/analytics', 'GET', bt)).status, 'not_403');
    check('GET /api/v1/invoices (manage_billing)',         (await apiRequest('/api/v1/invoices', 'GET', bt)).status, 200);
    check('GET /api/lab-orders [DENY] (no manage_lab)',    (await apiRequest('/api/lab-orders', 'GET', bt)).status, 403);
    check('GET /api/v1/patients (has view_patients)',      (await apiRequest('/api/v1/patients', 'GET', bt)).status, 200);
    check('POST /api/v1/records [DENY]',                   (await apiRequest('/api/v1/records', 'POST', bt, {patientId:1})).status, 403);
  }

  // ─── lab_admin ────────────────────────────────────────────────────────────
  if (tokens['lab_admin']) {
    console.log('\n▶ Testing lab_admin permissions:');
    const lt = tokens['lab_admin'];
    check('GET /api/lab-orders (manage_lab_orders)',        (await apiRequest('/api/lab-orders', 'GET', lt)).status, 200);
    check('GET /api/v1/patients (view_patients)',           (await apiRequest('/api/v1/patients', 'GET', lt)).status, 200);
    check('GET /payments/history [DENY]',                   (await apiRequest('/api/v1/payments/history', 'GET', lt)).status, 403);
    check('GET /api/v1/analytics [DENY]',                   (await apiRequest('/api/v1/analytics', 'GET', lt)).status, 403);
    check('POST /api/v1/records [DENY]',                    (await apiRequest('/api/v1/records', 'POST', lt, {patientId:1})).status, 403);
  }

  // ─── report_admin ─────────────────────────────────────────────────────────
  if (tokens['report_admin']) {
    console.log('\n▶ Testing report_admin permissions:');
    const rt = tokens['report_admin'];
    check('GET /api/v1/analytics (view_analytics): not_403',(await apiRequest('/api/v1/analytics', 'GET', rt)).status, 'not_403');
    check('GET /api/v1/patients (view_patients)',           (await apiRequest('/api/v1/patients', 'GET', rt)).status, 200);
    check('GET /api/v1/admin/audit-logs (view_analytics)', (await apiRequest('/api/v1/admin/audit-logs', 'GET', rt)).status, 200);
    check('POST /api/v1/records [DENY]',                    (await apiRequest('/api/v1/records', 'POST', rt, {patientId:1})).status, 403);
    check('GET /payments/history [DENY]',                   (await apiRequest('/api/v1/payments/history', 'GET', rt)).status, 403);
  }

  // ─── patient_manager ──────────────────────────────────────────────────────
  if (tokens['patient_manager']) {
    console.log('\n▶ Testing patient_manager permissions:');
    const pm = tokens['patient_manager'];
    check('GET /api/v1/patients (view_patients)',           (await apiRequest('/api/v1/patients', 'GET', pm)).status, 200);
    check('GET /api/v1/appointments (view_appointments)',   (await apiRequest('/api/v1/appointments', 'GET', pm)).status, 200);
    check('GET /api/v1/analytics [DENY]',                   (await apiRequest('/api/v1/analytics', 'GET', pm)).status, 403);
    check('GET /payments/history [DENY]',                   (await apiRequest('/api/v1/payments/history', 'GET', pm)).status, 403);
    check('POST /api/v1/records [DENY]',                    (await apiRequest('/api/v1/records', 'POST', pm, {patientId:1})).status, 403);
  }

  // ─── inventory_admin ──────────────────────────────────────────────────────
  if (tokens['inventory_admin']) {
    console.log('\n▶ Testing inventory_admin permissions:');
    const iv = tokens['inventory_admin'];
    check('GET /api/v1/inventory/items (manage_inventory)', (await apiRequest('/api/v1/inventory/items', 'GET', iv)).status, 200);
    check('GET /api/v1/analytics [DENY]',                   (await apiRequest('/api/v1/analytics', 'GET', iv)).status, 403);
    check('GET /payments/history [DENY]',                   (await apiRequest('/api/v1/payments/history', 'GET', iv)).status, 403);
    check('GET /api/v1/patients (has view_patients)',        (await apiRequest('/api/v1/patients', 'GET', iv)).status, 200);
  }

  // ─── Legacy roles backward compatibility ──────────────────────────────────
  console.log('\n▶ Testing legacy role backward compatibility:');
  check('admin: GET /payments/history',     (await apiRequest('/api/v1/payments/history', 'GET', adminToken)).status, 200);
  check('admin: GET /api/lab-orders',        (await apiRequest('/api/lab-orders', 'GET', adminToken)).status, 200);
  check('admin: GET /api/v1/patients',       (await apiRequest('/api/v1/patients', 'GET', adminToken)).status, 200);
  check('admin: GET /api/v1/analytics (not_403)', (await apiRequest('/api/v1/analytics', 'GET', adminToken)).status, 'not_403');
  check('admin: GET /api/v1/admin/audit-logs',(await apiRequest('/api/v1/admin/audit-logs', 'GET', adminToken)).status, 200);
  
  check('doctor: GET /api/v1/appointments',  (await apiRequest('/api/v1/appointments', 'GET', doctorToken)).status, 200);
  check('doctor: GET /api/v1/patients',      (await apiRequest('/api/v1/patients', 'GET', doctorToken)).status, 200);
  check('doctor: GET /api/lab-orders',       (await apiRequest('/api/lab-orders', 'GET', doctorToken)).status, 200);
  check('doctor: GET /payments/history [DENY]', (await apiRequest('/api/v1/payments/history', 'GET', doctorToken)).status, 403);

  check('patient: GET /api/v1/appointments', (await apiRequest('/api/v1/appointments', 'GET', patientToken)).status, 200);
  check('patient: GET /api/v1/patients [DENY]', (await apiRequest('/api/v1/patients', 'GET', patientToken)).status, 403);

  check('receptionist: GET /api/v1/appointments', (await apiRequest('/api/v1/appointments', 'GET', receptionToken)).status, 200);
  check('receptionist: GET /api/v1/patients',      (await apiRequest('/api/v1/patients', 'GET', receptionToken)).status, 200);
  check('receptionist: GET /api/v1/analytics [DENY]', (await apiRequest('/api/v1/analytics', 'GET', receptionToken)).status, 403);

  // ─── Results ──────────────────────────────────────────────────────────────
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Results: ${PASS} PASSED, ${FAIL} FAILED`);
  if (FAIL === 0) {
    console.log('\n✅ RBAC Phase 6 validation: ALL PASS');
  } else {
    console.log('\n❌ RBAC Phase 6 validation: SOME FAILURES - review above');
    process.exit(1);
  }
}

run().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
