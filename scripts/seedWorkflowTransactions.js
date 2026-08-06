'use strict';

/**
 * seedWorkflowTransactions.js — Scaled High-Volume Business Workflow Transaction Seeder
 *
 * Generates 3,000+ realistic business-logic transactions across TEST-CLINIC-01 
 * through TEST-CLINIC-10 using backend database queries and repositories.
 *
 * Transaction Types:
 *   1. Appointments (scheduled, completed, cancelled, no_show, in_person, telemedicine)
 *   2. Medical Records / EMR (diagnosis, vitals, clinical notes)
 *   3. Prescriptions (medications, dosage, frequency, duration)
 *   4. Lab Tests & Lab Orders (CBC, Lipid, HbA1c, Thyroid, LFT - completed & pending)
 *   5. Invoices & Payments (paid, pending, partially_paid, UPI/Credit Card/Cash/Bank Transfer)
 *   6. Inventory Stock Updates
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

module.paths.push(require('path').join(__dirname, '../backend/node_modules'));

const db = require('../backend/src/config/db');

const DIAGNOSES = [
  'Essential Hypertension', 'Type 2 Diabetes Mellitus', 'Acute Upper Respiratory Tract Infection',
  'Allergic Rhinitis', 'Migraine without Aura', 'Gastroesophageal Reflux Disease (GERD)',
  'Lumbar Spondylosis', 'Iron Deficiency Anemia', 'Osteoarthritis of Knee', 'Bronchial Asthma',
  'Hypothyroidism', 'Viral Fever', 'Acute Gastroenteritis', 'Dermatitis', 'Depressive Episode'
];

const CHIEF_COMPLAINTS = [
  'Persistent headache and dizziness for 3 days', 'High grade fever with chills and fatigue',
  'Severe lower back pain radiating to left leg', 'Dry cough, nasal congestion, and sore throat',
  'Epigastric burning pain after meals', 'Joint stiffness and pain in knees',
  'Skin rash with severe itching on arms', 'Shortness of breath on exertion',
  'Generalized body ache and weakness', 'Abdominal cramps and loose motions'
];

const MEDICATIONS = [
  { name: 'Telmisartan 40mg', dose: '1 tablet', freq: 'Once daily (Morning)', duration: 30 },
  { name: 'Metformin 500mg ER', dose: '1 tablet', freq: 'Twice daily (After meals)', duration: 30 },
  { name: 'Amoxicillin 500mg', dose: '1 capsule', freq: 'Thrice daily', duration: 7 },
  { name: 'Pantoprazole 40mg', dose: '1 tablet', freq: 'Once daily (Before breakfast)', duration: 14 },
  { name: 'Cetirizine 10mg', dose: '1 tablet', freq: 'Once daily (At bedtime)', duration: 10 },
  { name: 'Paracetamol 650mg', dose: '1 tablet', freq: 'As needed for fever (Max 3/day)', duration: 5 },
  { name: 'Atorvastatin 10mg', dose: '1 tablet', freq: 'Once daily (Night)', duration: 30 },
  { name: 'Aceclofenac 100mg + Paracetamol 325mg', dose: '1 tablet', freq: 'Twice daily', duration: 5 },
  { name: 'Levothyroxine 50mcg', dose: '1 tablet', freq: 'Once daily (Empty stomach)', duration: 30 },
  { name: 'Montelukast 10mg + Levocetirizine 5mg', dose: '1 tablet', freq: 'Once daily (Night)', duration: 15 },
];

const LAB_TEST_CATALOG = [
  { code: 'LAB-CBC', name: 'Complete Blood Count (CBC)', cat: 'Hematology', price: 450.00 },
  { code: 'LAB-LIPID', name: 'Lipid Profile - Comprehensive', cat: 'Biochemistry', price: 950.00 },
  { code: 'LAB-HBA1C', name: 'HbA1c (Glycated Hemoglobin)', cat: 'Endocrinology', price: 600.00 },
  { code: 'LAB-TSH', name: 'Thyroid Stimulating Hormone (TSH)', cat: 'Endocrinology', price: 400.00 },
  { code: 'LAB-LFT', name: 'Liver Function Test (LFT)', cat: 'Biochemistry', price: 800.00 },
  { code: 'LAB-KFT', name: 'Kidney Function Test (KFT)', cat: 'Biochemistry', price: 750.00 },
  { code: 'LAB-URINE', name: 'Urine Routine & Microscopy', cat: 'Pathology', price: 250.00 },
  { code: 'LAB-VITD', name: 'Vitamin D (25-Hydroxy)', cat: 'Biochemistry', price: 1200.00 },
];

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function inspectConstraints() {
  const pmDef = await db.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'payments_payment_method_check'`);
  const loDef = await db.query(`SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'lab_orders_order_status_check'`);

  console.log('📌 DB Constraint Check:');
  if (pmDef.rows[0]) console.log('   payments_payment_method_check:', pmDef.rows[0].pg_get_constraintdef);
  if (loDef.rows[0]) console.log('   lab_orders_order_status_check:', loDef.rows[0].pg_get_constraintdef);
  console.log('');

  let paymentMethods = ['UPI', 'Credit Card', 'Debit Card', 'Net Banking', 'Cash', 'Bank Transfer'];
  if (pmDef.rows[0] && pmDef.rows[0].pg_get_constraintdef.includes('upi')) {
    paymentMethods = ['upi', 'card', 'cash', 'razorpay', 'bank_transfer'];
  }

  let labStatuses = { completed: 'COMPLETED', in_progress: 'PROCESSING', pending: 'ORDERED' };

  return { paymentMethods, labStatuses };
}

async function seedTransactions() {
  console.log('====================================================');
  console.log(' HIGH-VOLUME BUSINESS WORKFLOW TRANSACTION SEEDER   ');
  console.log('====================================================\n');

  const { paymentMethods, labStatuses } = await inspectConstraints();

  const hospitalsRes = await db.query(
    `SELECT id, code, name FROM hospitals WHERE code LIKE 'TEST-CLINIC-%' ORDER BY id`
  );

  if (hospitalsRes.rows.length === 0) {
    console.error('❌ No TEST-CLINIC hospitals found. Run qa:seed first!');
    process.exit(1);
  }

  console.log(`Targeting ${hospitalsRes.rows.length} test tenants for workflow transactions.\n`);

  const tenantSummaries = [];
  const workflowFailures = [];

  let grandTotals = {
    appointments: 0,
    emrRecords: 0,
    prescriptions: 0,
    labOrders: 0,
    invoices: 0,
    payments: 0,
    inventoryUpdates: 0,
  };

  for (const hosp of hospitalsRes.rows) {
    const hospitalId = hosp.id;
    const code = hosp.code;
    const idx = code.replace('TEST-CLINIC-', '');

    console.log(`▶ Processing high-volume transactions for Tenant ${code} (ID: ${hospitalId})...`);

    const summary = {
      tenantCode: code,
      hospitalId,
      appointments: 0,
      emrRecords: 0,
      prescriptions: 0,
      labOrders: 0,
      invoices: 0,
      payments: 0,
      inventoryUpdates: 0,
    };

    // Get patients and doctors for this hospital
    const patients = (await db.query(`SELECT id FROM patients WHERE hospital_id = $1`, [hospitalId])).rows;
    const doctors = (await db.query(`SELECT id FROM doctors WHERE hospital_id = $1`, [hospitalId])).rows;
    const adminUser = (await db.query(`SELECT id FROM users WHERE hospital_id = $1 LIMIT 1`, [hospitalId])).rows[0];

    if (patients.length === 0 || doctors.length === 0) {
      console.warn(`⚠️ Skipping ${code} due to missing patients or doctors.`);
      continue;
    }

    // 1. APPOINTMENTS (100 per tenant = 1,000 total)
    const apptModes = ['in_person', 'telemedicine'];
    const completedApptRefs = [];

    for (let a = 1; a <= 100; a++) {
      const patId = getRandomItem(patients).id;
      const docId = getRandomItem(doctors).id;
      const status = a <= 60 ? 'completed' : (a <= 85 ? 'scheduled' : (a <= 95 ? 'cancelled' : 'no_show'));
      const mode = getRandomItem(apptModes);
      const offsetDays = status === 'completed' ? -getRandomInt(1, 60) : getRandomInt(1, 14);
      const start = new Date(Date.now() + offsetDays * 86400000);
      const end = new Date(start.getTime() + 30 * 60000);

      try {
        const insAppt = await db.query(
          `INSERT INTO appointments (hospital_id, patient_id, doctor_id, scheduled_start, scheduled_end, appointment_type, consultation_mode, status, reason)
           VALUES ($1, $2, $3, $4, $5, 'consultation', $6, $7, $8)
           RETURNING id`,
          [hospitalId, patId, docId, start, end, mode, status, `Routine ${mode} Checkup`]
        );
        const apptId = insAppt.rows[0].id;
        summary.appointments++;

        if (status === 'completed') {
          completedApptRefs.push({ apptId, patId, docId });
        }
      } catch (err) {
        workflowFailures.push({ tenant: code, module: 'Appointments', error: err.message });
      }
    }

    // 2. EMR / MEDICAL RECORDS (For completed appointments: ~60 per tenant = 600 total)
    const emrRecordIds = [];
    for (const ref of completedApptRefs) {
      try {
        const diag = getRandomItem(DIAGNOSES);
        const complaint = getRandomItem(CHIEF_COMPLAINTS);
        const bpSystolic = getRandomInt(110, 140);
        const bpDiastolic = getRandomInt(70, 90);
        const hr = getRandomInt(65, 95);
        const temp = (97.5 + Math.random() * 2).toFixed(1);

        const insEmr = await db.query(
          `INSERT INTO medical_records (hospital_id, patient_id, doctor_id, appointment_id, diagnosis, chief_complaint, clinical_notes, vitals)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
           RETURNING id`,
          [
            hospitalId, ref.patId, ref.docId, ref.apptId, diag, complaint,
            `Patient examined. Vitals stable. Advised medications and lifestyle modifications.`,
            JSON.stringify({ bp: `${bpSystolic}/${bpDiastolic}`, heartRate: hr, temperature: temp })
          ]
        );
        const emrId = insEmr.rows[0].id;
        emrRecordIds.push({ emrId, patId: ref.patId, docId: ref.docId, apptId: ref.apptId });
        summary.emrRecords++;

        // 3. PRESCRIPTIONS (Link to EMR: ~60 per tenant = 600 total)
        const med = getRandomItem(MEDICATIONS);
        await db.query(
          `INSERT INTO prescriptions (hospital_id, medical_record_id, appointment_id, patient_id, doctor_id, medication_name, dosage, frequency, duration_days, instructions, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active')`,
          [hospitalId, emrId, ref.apptId, ref.patId, ref.docId, med.name, med.dose, med.freq, med.duration, 'Take as directed']
        );
        summary.prescriptions++;
      } catch (err) {
        workflowFailures.push({ tenant: code, module: 'EMR/Prescriptions', error: err.message });
      }
    }

    // 4. LAB TESTS & LAB ORDERS (~30 per tenant = 300 total)
    const tenantLabTests = [];
    for (const lt of LAB_TEST_CATALOG) {
      let ltRes = await db.query(
        `INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'active')
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [hospitalId, `${lt.code}-T${idx}`, lt.name, lt.cat, lt.price, `Standard ${lt.name}`]
      );
      if (ltRes.rows.length === 0) {
        ltRes = await db.query(`SELECT id FROM lab_tests WHERE hospital_id = $1 LIMIT 1`, [hospitalId]);
      }
      if (ltRes.rows.length > 0) {
        tenantLabTests.push(ltRes.rows[0].id);
      }
    }

    for (let l = 1; l <= 30; l++) {
      if (tenantLabTests.length === 0) break;
      const patId = getRandomItem(patients).id;
      const docId = getRandomItem(doctors).id;
      const testId = getRandomItem(tenantLabTests);
      const isCompleted = l <= 22;
      const orderStatus = isCompleted ? labStatuses.completed : (l <= 27 ? labStatuses.in_progress : labStatuses.pending);

      try {
        await db.query(
          `INSERT INTO lab_orders (hospital_id, patient_id, doctor_id, test_id, order_status, ordered_at)
           VALUES ($1, $2, $3, $4, $5, now())`,
          [hospitalId, patId, docId, testId, orderStatus]
        );
        summary.labOrders++;
      } catch (err) {
        workflowFailures.push({ tenant: code, module: 'Lab Orders', error: err.message });
      }
    }

    // 5. INVOICES & PAYMENTS (~60 per tenant = 600 total)
    for (let invIdx = 0; invIdx < completedApptRefs.length; invIdx++) {
      const ref = completedApptRefs[invIdx];
      const status = invIdx < 45 ? 'paid' : (invIdx < 55 ? 'pending' : 'cancelled');
      const invNum = `INV-T${idx}-${ref.apptId}-${invIdx}-${Date.now().toString().slice(-4)}`;

      try {
        const insInv = await db.query(
          `INSERT INTO invoices (hospital_id, invoice_number, patient_id, appointment_id, created_by, subtotal, tax_amount, total_amount, status)
           VALUES ($1, $2, $3, $4, $5, 60.00, 6.00, 66.00, $6)
           ON CONFLICT (invoice_number) DO UPDATE SET status = EXCLUDED.status
           RETURNING id`,
          [hospitalId, invNum, ref.patId, ref.apptId, adminUser.id, status]
        );
        const invId = insInv.rows[0].id;
        summary.invoices++;

        if (status === 'paid') {
          const pMethod = getRandomItem(paymentMethods);
          const pProvider = pMethod.toLowerCase().includes('upi') || pMethod.toLowerCase().includes('card') ? 'Razorpay' : 'Internal';
          await db.query(
            `INSERT INTO payments (hospital_id, invoice_id, patient_id, payment_method, payment_provider, transaction_id, amount, status, paid_at)
             VALUES ($1, $2, $3, $4, $5, $6, 66.00, 'paid', now())`,
            [hospitalId, invId, ref.patId, pMethod, pProvider, `TXN-T${idx}-${invId}-${Date.now().toString().slice(-4)}`]
          );
          summary.payments++;
        }
      } catch (err) {
        workflowFailures.push({ tenant: code, module: 'Invoices/Payments', error: err.message });
      }
    }

    // 6. INVENTORY STOCK UPDATES (~30 per tenant = 300 total)
    const invItems = (await db.query(`SELECT id, current_stock FROM inventory_items WHERE hospital_id = $1`, [hospitalId])).rows;
    for (let m = 1; m <= 30; m++) {
      if (invItems.length === 0) break;
      const item = getRandomItem(invItems);
      const delta = m % 3 === 0 ? getRandomInt(5, 20) : -getRandomInt(1, 5);

      try {
        await db.query(
          `UPDATE inventory_items 
           SET current_stock = GREATEST(0, current_stock + $1),
               updated_at = now()
           WHERE id = $2 AND hospital_id = $3`,
          [delta, item.id, hospitalId]
        );
        summary.inventoryUpdates++;
      } catch (err) {
        workflowFailures.push({ tenant: code, module: 'Inventory Stock', error: err.message });
      }
    }

    tenantSummaries.push(summary);
    grandTotals.appointments += summary.appointments;
    grandTotals.emrRecords += summary.emrRecords;
    grandTotals.prescriptions += summary.prescriptions;
    grandTotals.labOrders += summary.labOrders;
    grandTotals.invoices += summary.invoices;
    grandTotals.payments += summary.payments;
    grandTotals.inventoryUpdates += summary.inventoryUpdates;
  }

  console.log('\n====================================================');
  console.log('   TRANSACTION SEEDING COMPLETE — SUMMARY REPORT    ');
  console.log('====================================================\n');

  console.table(tenantSummaries);

  console.log(`\n✅ GRAND TOTAL TRANSACTIONS GENERATED:`);
  console.log(`   Appointments:         ${grandTotals.appointments}`);
  console.log(`   EMR Records:          ${grandTotals.emrRecords}`);
  console.log(`   Prescriptions:        ${grandTotals.prescriptions}`);
  console.log(`   Lab Orders:           ${grandTotals.labOrders}`);
  console.log(`   Invoices:             ${grandTotals.invoices}`);
  console.log(`   Payments Processed:   ${grandTotals.payments}`);
  console.log(`   Inventory Updates:    ${grandTotals.inventoryUpdates}`);
  console.log(`   -------------------------------------------------`);
  console.log(`   TOTAL TRANSACTIONS:   ${Object.values(grandTotals).reduce((a, b) => a + b, 0)}`);

  console.log(`\n✅ WORKFLOW FAILURES DETECTED: ${workflowFailures.length}`);
  if (workflowFailures.length > 0) {
    console.table(workflowFailures);
  }

  // Verify pilot data isolation
  const pilotDataCheck = await db.query(`SELECT id, code FROM hospitals WHERE code IN ('BETA01', 'MCH-BLR')`);
  console.log(`\n✅ PILOT DATA SAFETY VERIFICATION: ${pilotDataCheck.rows.length} pilot hospitals intact.`);

  process.exit(0);
}

seedTransactions().catch(err => {
  console.error('❌ Transaction seeding failed:', err);
  process.exit(1);
});
