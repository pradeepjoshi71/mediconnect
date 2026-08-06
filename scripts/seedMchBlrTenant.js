'use strict';

/**
 * seedMchBlrTenant.js — Targeted Seeding for Demo Pilot Clinic MCH-BLR (Hospital ID = 2)
 *
 * Safe, scoped seeding of MCH-BLR:
 * - 50 Patients
 * - 3 Doctors
 * - 5 Staff Roles (Hospital Admin, Receptionist, Billing Admin, Inventory Admin, Lab Admin)
 * - 300 Appointments (scheduled, completed, cancelled)
 * - EMR Medical Records & Prescriptions
 * - Lab Orders & Test Results (uppercase enum values)
 * - Invoices & Payments (title-case enum values)
 * - Pharmacy Inventory Items
 *
 * Guarantees ZERO modification to any other hospital/tenant (BETA01, TEST-CLINIC-01 through 10).
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

module.paths.push(require('path').join(__dirname, '../backend/node_modules'));

const db = require('../backend/src/config/db');
const bcrypt = require('bcrypt');
const { signAccessToken } = require('../backend/src/utils/tokens');
const http = require('http');

const FIRST_NAMES_MALE = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan'];
const FIRST_NAMES_FEMALE = ['Saanvi', 'Aanya', 'Aadhya', 'Aaradhya', 'Ananya', 'Pari', 'Anika', 'Navya', 'Diya', 'Avani'];
const LAST_NAMES = ['Sharma', 'Verma', 'Gupta', 'Patel', 'Mehta', 'Joshi', 'Bhat', 'Rao', 'Nair', 'Pillai'];
const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-'];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seedMchBlr() {
  console.log('====================================================');
  console.log('    MCH-BLR DEMO CLINIC SEEDER (HOSPITAL ID = 2)    ');
  console.log('====================================================\n');

  // Verify target hospital exists
  const hospRes = await db.query(`SELECT id, code, name FROM hospitals WHERE id = 2 AND code = 'MCH-BLR'`);
  if (hospRes.rows.length === 0) {
    console.error('❌ Hospital ID 2 (MCH-BLR) not found!');
    process.exit(1);
  }
  const hospId = 2;

  // Record baseline row counts for ALL OTHER hospitals to verify 0 side effects
  const baselineOtherRes = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM patients WHERE hospital_id != $1) AS patients,
      (SELECT COUNT(*) FROM doctors WHERE hospital_id != $1) AS doctors,
      (SELECT COUNT(*) FROM appointments WHERE hospital_id != $1) AS appointments,
      (SELECT COUNT(*) FROM invoices WHERE hospital_id != $1) AS invoices
  `, [hospId]);
  const baselineOther = baselineOtherRes.rows[0];
  console.log('Baseline counts for OTHER hospitals (hospital_id != 2):', baselineOther);

  const passwordHash = await bcrypt.hash('Password@123', 10);

  const rolesRes = await db.query(`SELECT id, code FROM roles`);
  const roleMap = {};
  rolesRes.rows.forEach(r => roleMap[r.code] = r.id);

  // Helper to create or get user for hospital 2
  async function createMchUser(email, fullName, roleCode, phone) {
    const roleId = roleMap[roleCode] || roleMap['patient'];
    const res = await db.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
       VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
       ON CONFLICT (hospital_id, lower(email)) DO UPDATE SET full_name = EXCLUDED.full_name
       RETURNING id`,
      [hospId, roleId, fullName, email, passwordHash, phone]
    );
    const uId = res.rows[0].id;
    await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [uId, roleId]);
    return uId;
  }

  // 1. Staff Users
  const adminUserId = await createMchUser('admin@mediconnect.local', 'Asha Menon', 'admin', '+91-8044123301');
  await createMchUser('reception@mediconnect.local', 'Nina Kapoor', 'receptionist', '+91-8044123302');
  await createMchUser('billing@mediconnect.local', 'Ramesh Kumar', 'billing_admin', '+91-8044123303');
  await createMchUser('inventory@mediconnect.local', 'Priya Shah', 'inventory_admin', '+91-8044123304');
  await createMchUser('lab@mediconnect.local', 'Sunil Verma', 'lab_admin', '+91-8044123305');

  // 2. Doctors
  const docIds = [];
  const doctorSpecs = [
    { name: 'Dr. Rohan Mehta', spec: 'General Medicine', code: 'DOC-BLR-01', email: 'doctor@mediconnect.local' },
    { name: 'Dr. Ananya Sharma', spec: 'Pediatrics', code: 'DOC-BLR-02', email: 'dr.ananya@mediconnect.local' },
    { name: 'Dr. Vikram Patel', spec: 'Cardiology', code: 'DOC-BLR-03', email: 'dr.vikram@mediconnect.local' },
  ];

  for (const d of doctorSpecs) {
    const uId = await createMchUser(d.email, d.name, 'doctor', `+91-804412331${docIds.length + 1}`);
    let dRes = await db.query(`SELECT id FROM doctors WHERE user_id = $1`, [uId]);
    let dId;
    if (dRes.rows.length === 0) {
      const insD = await db.query(
        `INSERT INTO doctors (hospital_id, user_id, specialization, department, consultation_fee_cents, employee_code, license_number)
         VALUES ($1, $2, $3, $4, 7500, $5, $6) RETURNING id`,
        [hospId, uId, d.spec, d.spec, d.code, `MCI-BLR-0${docIds.length + 1}`]
      );
      dId = insD.rows[0].id;
    } else {
      dId = dRes.rows[0].id;
    }
    docIds.push(dId);
  }

  // 3. Patients
  const patIds = [];
  for (let p = 1; p <= 50; p++) {
    const isFemale = p % 2 === 0;
    const fn = isFemale ? getRandom(FIRST_NAMES_FEMALE) : getRandom(FIRST_NAMES_MALE);
    const ln = getRandom(LAST_NAMES);
    const fullName = `${fn} ${ln}`;
    const gender = isFemale ? 'female' : 'male';
    const dob = `19${70 + (p % 25)}-${(1 + (p % 12)).toString().padStart(2, '0')}-${(1 + (p % 25)).toString().padStart(2, '0')}`;
    const pEmail = `patient${p}.blr@mediconnect.local`;
    const pPhone = `+91-98450${p.toString().padStart(5, '0')}`;

    const uId = await createMchUser(pEmail, fullName, 'patient', pPhone);
    let pRes = await db.query(`SELECT id FROM patients WHERE user_id = $1`, [uId]);
    let pId;
    if (pRes.rows.length === 0) {
      const insP = await db.query(
        `INSERT INTO patients (hospital_id, user_id, medical_record_number, date_of_birth, gender, blood_group)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [hospId, uId, `MRN-BLR-${p.toString().padStart(4, '0')}`, dob, gender, getRandom(BLOOD_GROUPS)]
      );
      pId = insP.rows[0].id;
    } else {
      pId = pRes.rows[0].id;
    }

    await db.query(
      `INSERT INTO patient_abha_details (tenant_id, patient_id, abha_number, abha_address, verification_status, verified_at)
       VALUES ($1, $2, $3, $4, 'verified', now())
       ON CONFLICT (tenant_id, patient_id) DO NOTHING`,
      [hospId, pId, `91-0200-${p.toString().padStart(4, '0')}-00`, `${fn.toLowerCase()}.${p}@abdm`]
    );

    patIds.push(pId);
  }

  // 4. Lab Test Catalog for MCH-BLR
  const labTestRes = await db.query(
    `INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
     VALUES ($1, 'CBC-BLR', 'Complete Blood Count', 'Hematology', 500, 'Standard CBC Test', 'active')
     ON CONFLICT DO NOTHING RETURNING id`,
    [hospId]
  );
  let testId = labTestRes.rows[0]?.id;
  if (!testId) {
    const existingLt = await db.query(`SELECT id FROM lab_tests WHERE hospital_id = $1 LIMIT 1`, [hospId]);
    testId = existingLt.rows[0]?.id;
  }

  // 5. Appointments, EMR, Invoices, Payments, Lab Orders
  let appointmentsSeeded = 0;
  let invoicesSeeded = 0;
  let labOrdersSeeded = 0;

  const statuses = ['completed', 'completed', 'scheduled', 'cancelled'];
  const paymentMethods = ['UPI', 'Credit Card', 'Cash'];

  for (let i = 1; i <= 300; i++) {
    const patId = patIds[i % patIds.length];
    const docId = docIds[i % docIds.length];
    const status = statuses[i % statuses.length];

    const daysOffset = (i % 60) - 30; // -30 days ago to +30 days future
    const start = new Date(Date.now() + daysOffset * 86400 * 1000);
    const end = new Date(start.getTime() + 30 * 60000);

    const apptRes = await db.query(
      `INSERT INTO appointments (hospital_id, patient_id, doctor_id, scheduled_start, scheduled_end, appointment_type, consultation_mode, status, reason)
       VALUES ($1, $2, $3, $4, $5, 'consultation', 'in_person', $6, $7) RETURNING id`,
      [hospId, patId, docId, start, end, status, 'Routine Checkup']
    );
    const apptId = apptRes.rows[0].id;
    appointmentsSeeded++;

    if (status === 'completed') {
      // EMR Record
      await db.query(
        `INSERT INTO medical_records (hospital_id, patient_id, doctor_id, appointment_id, chief_complaint, diagnosis, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [hospId, patId, docId, apptId, 'Mild fever and cough', 'Upper Respiratory Infection', 'Rest and hydration advised']
      );

      // Lab Order with valid uppercase status if testId exists
      if (testId) {
        await db.query(
          `INSERT INTO lab_orders (hospital_id, patient_id, doctor_id, test_id, order_status, ordered_at)
           VALUES ($1, $2, $3, $4, 'COMPLETED', now())`,
          [hospId, patId, docId, testId]
        );
        labOrdersSeeded++;
      }

      // Invoice with valid total
      const invNum = `INV-BLR-${apptId}-${i}-${Date.now().toString().slice(-4)}`;
      const invRes = await db.query(
        `INSERT INTO invoices (hospital_id, invoice_number, patient_id, appointment_id, created_by, subtotal, tax_amount, total_amount, status)
         VALUES ($1, $2, $3, $4, $5, 75.00, 7.50, 82.50, 'paid')
         ON CONFLICT (invoice_number) DO UPDATE SET status = EXCLUDED.status
         RETURNING id`,
        [hospId, invNum, patId, apptId, adminUserId]
      );
      const invId = invRes.rows[0].id;
      invoicesSeeded++;

      // Payment with valid title-case payment method
      const pMethod = paymentMethods[i % paymentMethods.length];
      await db.query(
        `INSERT INTO payments (hospital_id, invoice_id, patient_id, payment_method, payment_provider, transaction_id, amount, status, paid_at)
         VALUES ($1, $2, $3, $4, 'Razorpay', $5, 82.50, 'paid', now())`,
        [hospId, invId, patId, pMethod, `TXN-BLR-${invId}-${i}`]
      );
    }
  }

  // 6. Inventory Items for MCH-BLR
  const items = [
    { name: 'Paracetamol 500mg', sku: 'SKU-PAR-500' },
    { name: 'Amoxicillin 250mg', sku: 'SKU-AMX-250' },
    { name: 'Cetirizine 10mg', sku: 'SKU-CET-010' },
    { name: 'Surgical Gloves M', sku: 'SKU-GLV-00M' },
    { name: 'Digital Thermometer', sku: 'SKU-THM-001' }
  ];
  for (let k = 0; k < items.length; k++) {
    await db.query(
      `INSERT INTO inventory_items (hospital_id, item_name, sku, category, unit, current_stock, minimum_stock)
       VALUES ($1, $2, $3, 'Medicine', 'Box', 500, 10)
       ON CONFLICT (hospital_id, sku) DO NOTHING`,
      [hospId, items[k].name, items[k].sku]
    );
  }

  // Post-Seeding Safety Check: Verify zero changes to other hospitals
  const postOtherRes = await db.query(`
    SELECT
      (SELECT COUNT(*) FROM patients WHERE hospital_id != $1) AS patients,
      (SELECT COUNT(*) FROM doctors WHERE hospital_id != $1) AS doctors,
      (SELECT COUNT(*) FROM appointments WHERE hospital_id != $1) AS appointments,
      (SELECT COUNT(*) FROM invoices WHERE hospital_id != $1) AS invoices
  `, [hospId]);
  const postOther = postOtherRes.rows[0];

  console.log('Post-seed counts for OTHER hospitals (hospital_id != 2):', postOther);

  const isUnaffected = (
    baselineOther.patients === postOther.patients &&
    baselineOther.doctors === postOther.doctors &&
    baselineOther.appointments === postOther.appointments &&
    baselineOther.invoices === postOther.invoices
  );

  console.log(`\n🛡️ Other Hospitals Isolation Verification: ${isUnaffected ? 'CLEAN (0 Impact) ✅' : 'VIOLATION ❌'}`);

  // Test dashboard endpoints for MCH-BLR
  const token = signAccessToken({
    userId: 1,
    email: 'admin@mediconnect.local',
    role: 'admin',
    hospitalId: 2,
  });

  const sendReq = (pathStr) => {
    return new Promise((resolve) => {
      const opts = {
        hostname: 'localhost',
        port: 5000,
        path: pathStr,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` },
      };
      const req = http.request(opts, (res) => {
        let body = '';
        res.on('data', (c) => { body += c; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, data: body }); }
        });
      });
      req.on('error', (e) => resolve({ status: 0, error: e.message }));
      req.end();
    });
  };

  const pRes = await sendReq('/api/v1/patients?limit=10');
  const dRes = await sendReq('/api/v1/doctors');
  const aRes = await sendReq('/api/v1/appointments');
  const rRes = await sendReq('/api/v1/business/revenue');

  const dashSuccess = (
    pRes.status === 200 && Array.isArray(pRes.data) && pRes.data.length > 0 &&
    dRes.status === 200 && Array.isArray(dRes.data) && dRes.data.length > 0 &&
    aRes.status === 200 && Array.isArray(aRes.data) && aRes.data.length > 0 &&
    rRes.status === 200 && rRes.data?.summary?.monthlyRevenue > 0
  );

  console.log(`\n📊 Dashboard API Validation: ${dashSuccess ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log('Patients sample length:', pRes.data?.length);
  console.log('Doctors sample length:', dRes.data?.length);
  console.log('Appointments sample length:', aRes.data?.length);
  console.log('Monthly Revenue:', rRes.data?.summary?.monthlyRevenue);

  console.log('\n====================================================');
  console.log('         MCH-BLR CLINIC SEEDING COMPLETE            ');
  console.log('====================================================\n');
  console.log(`  Patients Seeded:      50`);
  console.log(`  Doctors Seeded:       3`);
  console.log(`  Staff Seeded:         5`);
  console.log(`  Appointments Seeded:  ${appointmentsSeeded}`);
  console.log(`  Lab Orders Seeded:    ${labOrdersSeeded}`);
  console.log(`  Invoices Seeded:      ${invoicesSeeded}`);
  console.log(`  Inventory Items:      ${items.length}`);

  process.exit(0);
}

seedMchBlr().catch(err => {
  console.error('❌ MCH-BLR seeding failed:', err);
  process.exit(1);
});
