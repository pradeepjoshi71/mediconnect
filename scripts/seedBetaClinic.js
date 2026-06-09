'use strict';

/**
 * seedBetaClinic.js — First real Beta Clinic onboarding script.
 *
 * Safely clears ALL test/dummy data (cascading from hospitals down),
 * then seeds the first real beta tenant with:
 *   • 1 Hospital (the beta clinic)
 *   • 1 Super Admin (platform-level)
 *   • 1 Hospital Admin (clinic-level)
 *
 * Passwords are bcrypt-hashed (cost 12).
 * PII fields (phone) are AES-256-GCM encrypted via our crypto module.
 *
 * Usage:
 *   ENCRYPTION_KEY=<key> node scripts/seedBetaClinic.js
 *
 * Safety guards:
 *   • Requires SEED_CONFIRM=true env var to prevent accidental runs
 *   • Wraps entire operation in a transaction — all-or-nothing
 *   • Will NOT run in production unless FORCE_SEED=true is explicitly set
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt       = require('bcrypt');
const { Pool }     = require('pg');
const { encryptData } = require('../backend/src/security/crypto');

// ─── Safety gates ─────────────────────────────────────────────────────────────

if (process.env.SEED_CONFIRM !== 'true') {
  console.error('❌  Aborted. Set SEED_CONFIRM=true to run this script.');
  console.error('    This script DELETES all existing data. Be absolutely sure.');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
  console.error('❌  Aborted in production. Set FORCE_SEED=true to override.');
  process.exit(1);
}

// ─── Beta Clinic Configuration ────────────────────────────────────────────────
// Override these via env vars to avoid hardcoding credentials in version control.

const BETA = {
  hospital: {
    name:         process.env.BETA_CLINIC_NAME         || 'MediConnect Beta Clinic',
    code:         process.env.BETA_CLINIC_CODE         || 'BETA01',
    slug:         process.env.BETA_CLINIC_SLUG         || 'beta01',
    timezone:     process.env.BETA_CLINIC_TIMEZONE     || 'Asia/Kolkata',
    countryCode:  process.env.BETA_CLINIC_COUNTRY      || 'IN',
    supportPhone: encryptData(process.env.BETA_CLINIC_PHONE || '+919999999999'),
    billingEmail: process.env.BETA_CLINIC_EMAIL        || 'billing@betaclinic.in',
    status:       'trial',
  },
  superAdmin: {
    fullName: process.env.SUPER_ADMIN_NAME  || 'Platform Super Admin',
    email:    process.env.SUPER_ADMIN_EMAIL || 'superadmin@mediconnect.app',
    password: process.env.SUPER_ADMIN_PASS  || (() => { throw new Error('SUPER_ADMIN_PASS env var is required.'); })(),
    phone:    encryptData(process.env.SUPER_ADMIN_PHONE || '+910000000001'),
  },
  clinicAdmin: {
    fullName: process.env.CLINIC_ADMIN_NAME  || 'Beta Clinic Admin',
    email:    process.env.CLINIC_ADMIN_EMAIL || 'admin@betaclinic.in',
    password: process.env.CLINIC_ADMIN_PASS  || (() => { throw new Error('CLINIC_ADMIN_PASS env var is required.'); })(),
    phone:    encryptData(process.env.CLINIC_ADMIN_PHONE || '+910000000002'),
  },
};

// ─── DB connection ────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 2,
  ssl: process.env.DB_SSL === 'false' ? undefined : { rejectUnauthorized: false },
});

// ─── Cascading delete order ───────────────────────────────────────────────────
// Tables are ordered leaf → root so FK constraints are satisfied.
// All have hospital_id or cascade from hospitals(id) ON DELETE CASCADE,
// so a single DELETE FROM hospitals would suffice — but we do it explicitly
// to be transparent about what is being removed.

const LEAF_TABLES = [
  'audit_logs',
  'beta_feedback',
  'backup_logs',
  'refresh_tokens',
  'device_tokens',
  'notifications',
  'lab_reports',
  'lab_order_items',
  'lab_orders',
  'prescriptions',
  'diagnoses',
  'allergies',
  'medical_records',
  'files',
  'file_metadata',
  'appointments',
  'doctor_time_off',
  'doctor_availability_rules',
  'invoices',
  'payments',
  'telemedicine_sessions',
  'insurance_claims',
  'patients',
  'doctors',
  'departments',
  'user_roles',
  'users',
  'hospitals',
];

// ─── Main seed function ───────────────────────────────────────────────────────

async function seed() {
  const client = await pool.connect();
  console.log('\n🌱  MediConnect Beta Clinic Seed\n' + '─'.repeat(50));

  try {
    await client.query('BEGIN');

    // ── Step 1: Cascade-delete all existing data ──────────────────────────
    console.log('🗑️   Clearing existing data...');
    for (const table of LEAF_TABLES) {
      try {
        const res = await client.query(`DELETE FROM ${table}`);
        if (res.rowCount > 0) {
          console.log(`     ✓  ${table}: removed ${res.rowCount} row(s)`);
        }
      } catch (err) {
        // Table may not exist yet (e.g. beta_feedback — will be created by migration)
        if (err.code === '42P01') {
          console.log(`     –  ${table}: table does not exist yet, skipping`);
        } else {
          throw err;
        }
      }
    }

    // Reset all sequences so IDs start from 1 cleanly
    await client.query(`
      DO $$
      DECLARE seq RECORD;
      BEGIN
        FOR seq IN
          SELECT sequencename FROM pg_sequences WHERE schemaname = 'public'
        LOOP
          EXECUTE 'ALTER SEQUENCE ' || seq.sequencename || ' RESTART WITH 1';
        END LOOP;
      END $$;
    `);
    console.log('     ✓  All sequences reset to 1\n');

    // ── Step 2: Create Beta Hospital ─────────────────────────────────────
    console.log('🏥   Creating beta clinic hospital...');
    const hospRes = await client.query(
      `INSERT INTO hospitals (name, code, slug, timezone, country_code, support_phone, billing_email, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, code`,
      [
        BETA.hospital.name,
        BETA.hospital.code.toUpperCase(),
        BETA.hospital.slug.toLowerCase(),
        BETA.hospital.timezone,
        BETA.hospital.countryCode,
        BETA.hospital.supportPhone,    // already encrypted
        BETA.hospital.billingEmail,
        BETA.hospital.status,
      ]
    );
    const hospital = hospRes.rows[0];
    console.log(`     ✓  Hospital: "${hospital.name}" (ID: ${hospital.id}, Code: ${hospital.code})\n`);

    // Seed standard departments for the beta clinic
    const DEPARTMENTS = [
      ['GENERAL',    'General Medicine', 'General Outpatient and Internal Medicine'],
      ['CARDIOLOGY', 'Cardiology',       'Cardiac Sciences and Heart Disease'],
      ['RADIOLOGY',  'Radiology',        'Imaging and Diagnostic Radiology'],
      ['PHARMACY',   'Pharmacy',         'Medications and Drug Dispensing'],
      ['LABORATORY', 'Laboratory',       'Lab Tests and Diagnostics'],
    ];
    for (const [code, name, descr] of DEPARTMENTS) {
      await client.query(
        `INSERT INTO departments (hospital_id, department_code, department_name, description)
         VALUES ($1, $2, $3, $4) ON CONFLICT (hospital_id, department_code) DO NOTHING`,
        [hospital.id, code, name, descr]
      );
    }
    console.log('     ✓  5 departments seeded\n');

    // ── Step 3: Create Super Admin ────────────────────────────────────────
    console.log('👤   Creating Super Admin...');
    const superAdminRoleRes = await client.query(
      `SELECT id FROM roles WHERE code = 'super_admin' LIMIT 1`
    );
    if (!superAdminRoleRes.rows[0]) throw new Error("Role 'super_admin' not found. Run migrations first.");

    const superAdminRoleId  = superAdminRoleRes.rows[0].id;
    const superAdminPwHash  = await bcrypt.hash(BETA.superAdmin.password, 12);

    const superAdminRes = await client.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
       VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
       RETURNING id, email`,
      [
        hospital.id,
        superAdminRoleId,
        BETA.superAdmin.fullName,
        BETA.superAdmin.email,
        superAdminPwHash,
        BETA.superAdmin.phone,   // AES-256-GCM encrypted
      ]
    );
    const superAdmin = superAdminRes.rows[0];
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [superAdmin.id, superAdminRoleId]
    );
    console.log(`     ✓  Super Admin: ${superAdmin.email} (ID: ${superAdmin.id})\n`);

    // ── Step 4: Create Hospital/Clinic Admin ──────────────────────────────
    console.log('👤   Creating Clinic Admin (hospital_admin)...');
    const clinicAdminRoleRes = await client.query(
      `SELECT id FROM roles WHERE code = 'hospital_admin' LIMIT 1`
    );
    if (!clinicAdminRoleRes.rows[0]) throw new Error("Role 'hospital_admin' not found. Run migrations first.");

    const clinicAdminRoleId = clinicAdminRoleRes.rows[0].id;
    const clinicAdminPwHash = await bcrypt.hash(BETA.clinicAdmin.password, 12);

    const clinicAdminRes = await client.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
       VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
       RETURNING id, email`,
      [
        hospital.id,
        clinicAdminRoleId,
        BETA.clinicAdmin.fullName,
        BETA.clinicAdmin.email,
        clinicAdminPwHash,
        BETA.clinicAdmin.phone,  // AES-256-GCM encrypted
      ]
    );
    const clinicAdmin = clinicAdminRes.rows[0];
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [clinicAdmin.id, clinicAdminRoleId]
    );
    console.log(`     ✓  Clinic Admin: ${clinicAdmin.email} (ID: ${clinicAdmin.id})\n`);

    // ── Step 5: Seed initial backup_scheduler_config rows ────────────────
    const BACKUP_TYPES = ['database', 'storage', 'notification_job', 'push_retry_job', 'cleanup_job'];
    for (const type of BACKUP_TYPES) {
      await client.query(
        `INSERT INTO backup_scheduler_config (backup_type, enabled, cron_expression, retention_days)
         VALUES ($1, true, '0 2 * * *', 30)
         ON CONFLICT (backup_type) DO NOTHING`,
        [type]
      );
    }
    console.log('     ✓  Backup scheduler config seeded\n');

    await client.query('COMMIT');

    console.log('─'.repeat(50));
    console.log('✅  Beta clinic seeded successfully!\n');
    console.log('  Clinic    :', hospital.name, `(Code: ${hospital.code})`);
    console.log('  Super Admin:', superAdmin.email);
    console.log('  Clinic Admin:', clinicAdmin.email);
    console.log('\n⚠️   SECURITY: Delete or rotate these credentials after first login.\n');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Seed failed — transaction rolled back:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
