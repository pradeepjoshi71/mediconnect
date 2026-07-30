'use strict';

/**
 * seedTestTenants.js — Multi-Tenant QA Test Data Seeder
 *
 * Seeds 10 realistic, isolated test clinic tenants (TEST-CLINIC-01 to TEST-CLINIC-10)
 * via app-layer services & repositories.
 *
 * Safety & Isolation:
 *   • ADDITIVE ONLY: Leaves existing pilot clinics (BETA01, MCH-BLR) untouched.
 *   • Namespaced tenant codes: TEST-CLINIC-01 ... TEST-CLINIC-10
 *   • Tagged metadata: settings { is_test_data: true }
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

module.paths.push(require('path').join(__dirname, '../backend/node_modules'));

const db = require('../backend/src/config/db');
const bcrypt = require('bcrypt');
const auditService = require('../backend/src/services/auditService');

const CLINICS = [
  { code: 'TEST-CLINIC-01', slug: 'test-clinic-01', name: 'Test Clinic 01 - General Medicine', specialty: 'General Medicine' },
  { code: 'TEST-CLINIC-02', slug: 'test-clinic-02', name: 'Test Clinic 02 - Dental Care', specialty: 'Dentistry' },
  { code: 'TEST-CLINIC-03', slug: 'test-clinic-03', name: 'Test Clinic 03 - Pediatric Health Center', specialty: 'Pediatrics' },
  { code: 'TEST-CLINIC-04', slug: 'test-clinic-04', name: 'Test Clinic 04 - Heart & Cardiac Institute', specialty: 'Cardiology' },
  { code: 'TEST-CLINIC-05', slug: 'test-clinic-05', name: 'Test Clinic 05 - Orthopedic Care Center', specialty: 'Orthopedics' },
  { code: 'TEST-CLINIC-06', slug: 'test-clinic-06', name: 'Test Clinic 06 - Eye & Vision Care Clinic', specialty: 'Ophthalmology' },
  { code: 'TEST-CLINIC-07', slug: 'test-clinic-07', name: 'Test Clinic 07 - Skin & Dermatology Clinic', specialty: 'Dermatology' },
  { code: 'TEST-CLINIC-08', slug: 'test-clinic-08', name: 'Test Clinic 08 - ENT & Allergy Clinic', specialty: 'Otolaryngology (ENT)' },
  { code: 'TEST-CLINIC-09', slug: 'test-clinic-09', name: 'Test Clinic 09 - Neuro Care Center', specialty: 'Neurology' },
  { code: 'TEST-CLINIC-10', slug: 'test-clinic-10', name: 'Test Clinic 10 - Oncology Care Center', specialty: 'Oncology' },
];

const PATIENT_TEMPLATES = [
  { name: 'Aarav Sharma', dob: '1985-04-12', gender: 'male', blood: 'O+', phone: '+91-9876543210' },
  { name: 'Priya Patel', dob: '1992-09-25', gender: 'female', blood: 'A+', phone: '+91-9876543211' },
  { name: 'Rohan Gupta', dob: '2010-06-15', gender: 'male', blood: 'B+', phone: '+91-9876543212' },
];

async function getRoleId(code) {
  const res = await db.query(`SELECT id FROM roles WHERE code = $1 LIMIT 1`, [code]);
  return res.rows[0]?.id;
}

async function seed() {
  console.log('====================================================');
  console.log('       MULTI-TENANT TEST DATA SEEDER RUNNER         ');
  console.log('====================================================\n');

  // Check initial state
  const initialHospitals = await db.query(`SELECT id, code FROM hospitals`);
  const initialCodes = initialHospitals.rows.map(h => h.code);
  console.log(`Initial hospital count in DB: ${initialHospitals.rows.length} (${initialCodes.join(', ')})`);

  const passwordHash = await bcrypt.hash('Password@123', 10);

  const roleMap = {
    admin: await getRoleId('admin'),
    hospital_admin: await getRoleId('hospital_admin'),
    doctor: await getRoleId('doctor'),
    receptionist: await getRoleId('receptionist'),
    billing_admin: await getRoleId('billing_admin'),
    inventory_admin: await getRoleId('inventory_admin'),
    lab_admin: await getRoleId('lab_admin'),
    patient: await getRoleId('patient'),
  };

  const report = [];

  for (let i = 0; i < CLINICS.length; i++) {
    const c = CLINICS[i];
    const idx = (i + 1).toString().padStart(2, '0');
    console.log(`\n▶ Seeding Tenant [${idx}/10]: ${c.code} (${c.specialty})...`);

    // 1. Create Hospital Tenant if not exists
    let hospitalRes = await db.query(`SELECT id FROM hospitals WHERE code = $1`, [c.code]);
    let hospitalId;
    if (hospitalRes.rows.length === 0) {
      const insHosp = await db.query(
        `INSERT INTO hospitals (code, slug, name, timezone, country_code, support_phone, billing_email, status, settings)
         VALUES ($1, $2, $3, 'Asia/Kolkata', 'IN', '+91-9000000000', $4, 'active', $5::jsonb)
         RETURNING id`,
        [c.code, c.slug, c.name, `billing@${c.slug}.local`, JSON.stringify({ is_test_data: true, specialty: c.specialty })]
      );
      hospitalId = insHosp.rows[0].id;
    } else {
      hospitalId = hospitalRes.rows[0].id;
    }

    const counts = {
      tenantCode: c.code,
      hospitalId,
      users: 0,
      patients: 0,
      doctors: 0,
      staff: 0,
      appointments: 0,
      prescriptions: 0,
      invoices: 0,
      payments: 0,
      inventoryItems: 0,
      abhaRecords: 0,
      pmjayClaims: 0,
      auditLogs: 0,
    };

    // Helper to create user
    async function createUser(email, fullName, roleCode, phone = '+91-9000000099') {
      const roleId = roleMap[roleCode] || roleMap['admin'];
      const userRes = await db.query(
        `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
         VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
         ON CONFLICT (hospital_id, lower(email)) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [hospitalId, roleId, fullName, email, passwordHash, phone]
      );
      const userId = userRes.rows[0].id;
      await db.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, roleId]);
      counts.users++;
      return userId;
    }

    // 2. Create Staff Users (Hospital Admin, Receptionist, Billing Admin, Inventory Admin, Lab Admin)
    const hAdminId = await createUser(`admin@${c.slug}.local`, `Admin ${c.code}`, 'hospital_admin');
    const recepId  = await createUser(`reception@${c.slug}.local`, `Receptionist ${c.code}`, 'receptionist');
    const billId   = await createUser(`billing@${c.slug}.local`, `Billing Admin ${c.code}`, 'billing_admin');
    const invId    = await createUser(`inventory@${c.slug}.local`, `Inventory Admin ${c.code}`, 'inventory_admin');
    const labId    = await createUser(`lab@${c.slug}.local`, `Lab Admin ${c.code}`, 'lab_admin');
    counts.staff += 5;

    // 3. Create Doctor User & Profile
    const docUserId = await createUser(`dr.${c.slug}@${c.slug}.local`, `Dr. Specialist ${idx}`, 'doctor');
    let docProfile = await db.query(`SELECT id FROM doctors WHERE user_id = $1`, [docUserId]);
    let docId;
    if (docProfile.rows.length === 0) {
      const insDoc = await db.query(
        `INSERT INTO doctors (hospital_id, user_id, specialization, department, consultation_fee_cents, employee_code, license_number)
         VALUES ($1, $2, $3, $4, 5000, $5, $6)
         RETURNING id`,
        [hospitalId, docUserId, c.specialty, c.specialty, `EMP-TC${idx}`, `LIC-TC${idx}`]
      );
      docId = insDoc.rows[0].id;
    } else {
      docId = docProfile.rows[0].id;
    }
    counts.doctors++;

    // 4. Create Patients & Patient Profiles
    const patientIds = [];
    for (let pIdx = 0; pIdx < PATIENT_TEMPLATES.length; pIdx++) {
      const pTpl = PATIENT_TEMPLATES[pIdx];
      const pEmail = `patient${pIdx + 1}.${c.slug}@${c.slug}.local`;
      const pUserId = await createUser(pEmail, `${pTpl.name} (${c.code})`, 'patient', pTpl.phone);

      let patRes = await db.query(`SELECT id FROM patients WHERE user_id = $1`, [pUserId]);
      let patId;
      if (patRes.rows.length === 0) {
        const insPat = await db.query(
          `INSERT INTO patients (hospital_id, user_id, medical_record_number, date_of_birth, gender, blood_group)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [hospitalId, pUserId, `MRN-TC${idx}-${pIdx + 1}`, pTpl.dob, pTpl.gender, pTpl.blood]
        );
        patId = insPat.rows[0].id;
      } else {
        patId = patRes.rows[0].id;
      }
      patientIds.push(patId);
      counts.patients++;

      // 5. Create ABHA Record for Patient
      const abhaNum = `91-1234-5678-0${idx}${pIdx + 1}`;
      await db.query(
        `INSERT INTO patient_abha_details (tenant_id, patient_id, abha_number, abha_address, verification_status, verified_at)
         VALUES ($1, $2, $3, $4, 'verified', now())
         ON CONFLICT (tenant_id, patient_id) DO NOTHING`,
        [hospitalId, patId, abhaNum, `patient${pIdx + 1}.tc${idx}@abdm`]
      );
      counts.abhaRecords++;

      // 6. Create PM-JAY Beneficiary & Claim
      const pmjayId = `PMJAY-TC${idx}-${pIdx + 1}`;
      const benRes = await db.query(
        `INSERT INTO pmjay_beneficiaries (tenant_id, patient_id, pmjay_id, beneficiary_name, eligibility_status, verification_status, verified_at)
         VALUES ($1, $2, $3, $4, 'eligible', 'verified', now())
         ON CONFLICT (tenant_id, patient_id) DO UPDATE SET eligibility_status = 'eligible'
         RETURNING id`,
        [hospitalId, patId, pmjayId, `${pTpl.name}`]
      );
      const benId = benRes.rows[0].id;

      const claimNum = `CLM-TC${idx}-${pIdx + 1}`;
      await db.query(
        `INSERT INTO pmjay_claims (tenant_id, patient_id, beneficiary_id, claim_number, claim_amount, status, submitted_at)
         VALUES ($1, $2, $3, $4, 15000.00, 'SUBMITTED', now())
         ON CONFLICT (tenant_id, claim_number) DO NOTHING`,
        [hospitalId, patId, benId, claimNum]
      );
      counts.pmjayClaims++;
    }

    // 7. Create Appointments (Past Completed, Upcoming Scheduled, Telemedicine)
    const apptTypes = [
      { status: 'completed', mode: 'in_person', offsetDays: -3 },
      { status: 'scheduled', mode: 'in_person', offsetDays: 2 },
      { status: 'completed', mode: 'telemedicine', offsetDays: -1 },
    ];

    const completedApptIds = [];
    for (let pIdx = 0; pIdx < patientIds.length; pIdx++) {
      const patId = patientIds[pIdx];
      for (const aTpl of apptTypes) {
        const start = new Date(Date.now() + aTpl.offsetDays * 86400000);
        const end = new Date(start.getTime() + 30 * 60000);
        const insAppt = await db.query(
          `INSERT INTO appointments (hospital_id, patient_id, doctor_id, scheduled_start, scheduled_end, appointment_type, consultation_mode, status, reason)
           VALUES ($1, $2, $3, $4, $5, 'consultation', $6, $7, $8)
           RETURNING id`,
          [hospitalId, patId, docId, start, end, aTpl.mode, aTpl.status, `Regular Consultation - ${c.specialty}`]
        );
        const apptId = insAppt.rows[0].id;
        counts.appointments++;

        if (aTpl.status === 'completed') {
          completedApptIds.push({ apptId, patId });
        }
      }
    }

    // 8. Create Prescriptions & Medical Records for Completed Appointments
    for (const comp of completedApptIds) {
      const medRecord = await db.query(
        `INSERT INTO medical_records (hospital_id, patient_id, doctor_id, appointment_id, diagnosis, chief_complaint, clinical_notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          hospitalId,
          comp.patId,
          docId,
          comp.apptId,
          `Mild ${c.specialty} Condition`,
          'Standard symptoms reported during checkup',
          'Prescribed medication and rest for 5 days'
        ]
      );

      await db.query(
        `INSERT INTO prescriptions (hospital_id, medical_record_id, appointment_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions, status)
         VALUES ($1, $2, $3, $4, $5, 'Paracetamol 500mg', '1 tablet', 'Twice daily', 5, 'Take after meals', 'active')`,
        [
          hospitalId,
          medRecord.rows[0].id,
          comp.apptId,
          comp.patId,
          docId
        ]
      );
      counts.prescriptions++;

      // 9. Create Invoices & Payments
      const invNum = `INV-TC${idx}-${comp.apptId}`;
      const insInv = await db.query(
        `INSERT INTO invoices (hospital_id, invoice_number, patient_id, appointment_id, created_by, subtotal, tax_amount, total_amount, status)
         VALUES ($1, $2, $3, $4, $5, 50.00, 5.00, 55.00, 'paid')
         ON CONFLICT (invoice_number) DO UPDATE SET status = 'paid'
         RETURNING id`,
        [hospitalId, invNum, comp.patId, comp.apptId, hAdminId]
      );
      const invId = insInv.rows[0].id;
      counts.invoices++;

      await db.query(
        `INSERT INTO invoice_items (invoice_id, item_type, item_name, quantity, unit_price, total_price)
         VALUES ($1, 'consultation', $2, 1, 50.00, 50.00)`,
        [invId, `${c.specialty} Consultation`]
      );

      await db.query(
        `INSERT INTO payments (hospital_id, invoice_id, patient_id, payment_method, payment_provider, transaction_id, amount, status, paid_at)
         VALUES ($1, $2, $3, 'UPI', 'Razorpay', $4, 55.00, 'paid', now())`,
        [hospitalId, invId, comp.patId, `TXN-TC${idx}-${comp.apptId}`]
      );
      counts.payments++;
    }

    // 10. Create Inventory Items & Stock Levels (Including Low Stock Item)
    const inventoryTemplates = [
      { name: 'Sterile Syringes 5ml', sku: `SKU-TC${idx}-01`, category: 'Consumable', unit: 'Box', current: 150, min: 20 },
      { name: 'Examination Gloves (M)', sku: `SKU-TC${idx}-02`, category: 'Consumable', unit: 'Box', current: 200, min: 30 },
      { name: 'Paracetamol 500mg Tablets', sku: `SKU-TC${idx}-03`, category: 'Medicine', unit: 'Strip', current: 5, min: 25 }, // Low stock scenario!
      { name: 'Surgical Gauze Bandage', sku: `SKU-TC${idx}-04`, category: 'Consumable', unit: 'Piece', current: 80, min: 15 },
    ];

    for (const inv of inventoryTemplates) {
      await db.query(
        `INSERT INTO inventory_items (hospital_id, item_name, sku, category, unit, current_stock, minimum_stock)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (hospital_id, sku) DO NOTHING`,
        [hospitalId, inv.name, inv.sku, inv.category, inv.unit, inv.current, inv.min]
      );
      counts.inventoryItems++;
    }

    // 11. Generate Audit Log Entries
    await auditService.recordAuditEvent({
      user: { id: hAdminId, hospitalId, role: 'hospital_admin' },
      action: 'qa.seed.tenant_initialized',
      entityType: 'hospital',
      entityId: hospitalId,
      metadata: { tenantCode: c.code, specialty: c.specialty },
      context: { ip: '127.0.0.1', userAgent: 'qa-seeder' }
    });
    counts.auditLogs++;

    report.push(counts);
  }

  // Verify final count and safety checks
  console.log('\n====================================================');
  console.log('         SEEDING COMPLETE — SUMMARY REPORT          ');
  console.log('====================================================\n');

  const finalHospitals = await db.query(`SELECT id, code, name FROM hospitals ORDER BY id`);
  console.log(`Total hospitals in DB after seeding: ${finalHospitals.rows.length}`);
  console.table(report);

  // Confirm pilot data safety
  const pilotData = await db.query(`SELECT id, code, name FROM hospitals WHERE code IN ('BETA01', 'MCH-BLR')`);
  console.log('\n✅ PILOT DATA INTEGRITY VERIFICATION:');
  console.log(`   Existing pilot hospitals (${pilotData.rows.length} rows):`, pilotData.rows);

  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed with error:', err);
  process.exit(1);
});
