'use strict';

/**
 * seedBulkDemographics.js — Scaled Multi-Tenant Demographics Seeder
 *
 * Seeds 500+ realistic patients (50 per tenant), 20 doctors (2 per tenant),
 * and 50 staff members (5 per tenant covering all 5 staff roles) across 
 * TEST-CLINIC-01 through TEST-CLINIC-10.
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

module.paths.push(require('path').join(__dirname, '../backend/node_modules'));

const db = require('../backend/src/config/db');
const bcrypt = require('bcrypt');

const FIRST_NAMES_MALE = [
  'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
  'Shaurya', 'Kabir', 'Rudra', 'Aryan', 'Anay', 'Dev', 'Atharv', 'Dhruv', 'Rohan',
  'Pranav', 'Advait', 'Kavya', 'Karan', 'Manish', 'Nitin', 'Suresh', 'Ramesh', 'Amit', 'Rajesh',
  'Vikram', 'Sanjay', 'Sunil', 'Prakash', 'Alok', 'Deepak', 'Manoj', 'Vijay', 'Rahul', 'Ganesh'
];

const FIRST_NAMES_FEMALE = [
  'Saanvi', 'Aanya', 'Aadhya', 'Aaradhya', 'Ananya', 'Pari', 'Anika', 'Navya', 'Diya', 'Avani',
  'Myra', 'Anvi', 'Sara', 'Ira', 'Ahana', 'Riya', 'Ishita', 'Sneha', 'Priya', 'Pooja',
  'Neha', 'Kavita', 'Sunita', 'Anita', 'Meena', 'Geeta', 'Rekha', 'Shweta', 'Divya', 'Deepa',
  'Swati', 'Archana', 'Nisha', 'Rashmi', 'Preeti', 'Bhavna', 'Vandana', 'Smita', 'Lata', 'Usha'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Patel', 'Mehta', 'Joshi', 'Bhat', 'Rao', 'Nair', 'Pillai',
  'Reddy', 'Chowdhury', 'Mukherjee', 'Banerjee', 'Das', 'Sen', 'Singh', 'Kaur', 'Kumar', 'Yadav',
  'Mishra', 'Pandey', 'Trivedi', 'Jha', 'Deshmukh', 'Kulkarni', 'Patil', 'Pawar', 'Shinde', 'Jadhav',
  'Agarwal', 'Bansal', 'Goyal', 'Jain', 'Shah', 'Solanki', 'Chauhan', 'Rathore', 'Parmar', 'Thakur'
];

const BLOOD_GROUPS = ['A+', 'B+', 'O+', 'AB+', 'A-', 'B-', 'O-', 'AB-'];

const SPECIALTIES = [
  'General Medicine', 'Dentistry', 'Pediatrics', 'Cardiology', 'Orthopedics',
  'Ophthalmology', 'Dermatology', 'Otolaryngology (ENT)', 'Neurology', 'Oncology',
  'Gastroenterology', 'Gynecology', 'Pulmonology', 'Urology', 'Endocrinology'
];

async function getRoleId(code) {
  const res = await db.query(`SELECT id FROM roles WHERE code = $1 LIMIT 1`, [code]);
  return res.rows[0]?.id;
}

function getRandomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDOB(minAge = 8, maxAge = 75) {
  const now = new Date();
  const year = now.getFullYear() - (minAge + Math.floor(Math.random() * (maxAge - minAge)));
  const month = (1 + Math.floor(Math.random() * 12)).toString().padStart(2, '0');
  const day = (1 + Math.floor(Math.random() * 28)).toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seedBulk() {
  console.log('====================================================');
  console.log('    BULK DEMOGRAPHICS & STAFF SEEDER (500+ PATIENTS)  ');
  console.log('====================================================\n');

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

  const hospitalsRes = await db.query(
    `SELECT id, code, name FROM hospitals WHERE code LIKE 'TEST-CLINIC-%' ORDER BY id`
  );

  if (hospitalsRes.rows.length === 0) {
    console.error('❌ No TEST-CLINIC hospitals found. Run qa:seed first!');
    process.exit(1);
  }

  console.log(`Found ${hospitalsRes.rows.length} test tenants to populate.\n`);

  const summaryReport = [];
  let totalPatientsSeeded = 0;
  let totalDoctorsSeeded = 0;
  let totalStaffSeeded = 0;

  for (const hosp of hospitalsRes.rows) {
    const hospitalId = hosp.id;
    const code = hosp.code;
    const idx = code.replace('TEST-CLINIC-', '');
    const slug = `test-clinic-${idx.toLowerCase()}`;

    console.log(`▶ Populating Tenant ID ${hospitalId} (${code})...`);

    const tenantCounts = {
      hospitalId,
      tenantCode: code,
      hospitalAdmin: 0,
      receptionist: 0,
      billingAdmin: 0,
      inventoryAdmin: 0,
      labAdmin: 0,
      doctors: 0,
      patients: 0,
    };

    // Helper function to create users idempotently
    async function createUser(email, fullName, roleCode, phone) {
      const roleId = roleMap[roleCode] || roleMap['patient'];
      const userRes = await db.query(
        `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
         VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
         ON CONFLICT (hospital_id, lower(email)) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [hospitalId, roleId, fullName, email, passwordHash, phone]
      );
      const userId = userRes.rows[0].id;
      await db.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [userId, roleId]
      );
      return userId;
    }

    // 1. Ensure all 5 staff roles exist
    await createUser(`admin@${slug}.local`, `Hospital Admin ${code}`, 'hospital_admin', `+91-90000${idx}001`);
    tenantCounts.hospitalAdmin = 1;

    await createUser(`reception@${slug}.local`, `Receptionist ${code}`, 'receptionist', `+91-90000${idx}002`);
    tenantCounts.receptionist = 1;

    await createUser(`billing@${slug}.local`, `Billing Admin ${code}`, 'billing_admin', `+91-90000${idx}003`);
    tenantCounts.billingAdmin = 1;

    await createUser(`inventory@${slug}.local`, `Inventory Admin ${code}`, 'inventory_admin', `+91-90000${idx}004`);
    tenantCounts.inventoryAdmin = 1;

    await createUser(`lab@${slug}.local`, `Lab Admin ${code}`, 'lab_admin', `+91-90000${idx}005`);
    tenantCounts.labAdmin = 1;

    totalStaffSeeded += 5;

    // 2. Create 2 Doctors per tenant (2 * 10 = 20 total across 10 tenants)
    const docSpecs = [getRandomItem(SPECIALTIES), getRandomItem(SPECIALTIES)];
    for (let d = 1; d <= 2; d++) {
      const docEmail = `dr.${d}.${slug}@${slug}.local`;
      const docName = `Dr. ${getRandomItem(FIRST_NAMES_MALE)} ${getRandomItem(LAST_NAMES)}`;
      const docUserId = await createUser(docEmail, docName, 'doctor', `+91-90000${idx}01${d}`);

      let docRes = await db.query(`SELECT id FROM doctors WHERE user_id = $1`, [docUserId]);
      if (docRes.rows.length === 0) {
        await db.query(
          `INSERT INTO doctors (hospital_id, user_id, specialization, department, consultation_fee_cents, employee_code, license_number)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [hospitalId, docUserId, docSpecs[d - 1], docSpecs[d - 1], 6000, `DOC-T${idx}-0${d}`, `MCI-T${idx}-0${d}`]
        );
      }
      tenantCounts.doctors++;
      totalDoctorsSeeded++;
    }

    // 3. Create 50 Patients per tenant (50 * 10 = 500 total across 10 tenants)
    for (let p = 1; p <= 50; p++) {
      const isFemale = p % 2 === 0;
      const firstName = isFemale ? getRandomItem(FIRST_NAMES_FEMALE) : getRandomItem(FIRST_NAMES_MALE);
      const lastName = getRandomItem(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const gender = isFemale ? 'female' : 'male';
      const dob = getRandomDOB(8, 75);
      const bloodGroup = getRandomItem(BLOOD_GROUPS);
      const pEmail = `patient${p}.${slug}@${slug}.local`;
      const pPhone = `+91-9${idx.padStart(2, '0')}${p.toString().padStart(7, '0')}`;

      const pUserId = await createUser(pEmail, fullName, 'patient', pPhone);

      let patRes = await db.query(`SELECT id FROM patients WHERE user_id = $1`, [pUserId]);
      let patId;
      if (patRes.rows.length === 0) {
        const insPat = await db.query(
          `INSERT INTO patients (hospital_id, user_id, medical_record_number, date_of_birth, gender, blood_group)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [hospitalId, pUserId, `MRN-T${idx}-${p.toString().padStart(4, '0')}`, dob, gender, bloodGroup]
        );
        patId = insPat.rows[0].id;
      } else {
        patId = patRes.rows[0].id;
      }

      // Add ABHA detail
      await db.query(
        `INSERT INTO patient_abha_details (tenant_id, patient_id, abha_number, abha_address, verification_status, verified_at)
         VALUES ($1, $2, $3, $4, 'verified', now())
         ON CONFLICT (tenant_id, patient_id) DO NOTHING`,
        [hospitalId, patId, `91-${idx}00-${p.toString().padStart(4, '0')}-99`, `${firstName.toLowerCase()}.${p}@abdm`]
      );

      tenantCounts.patients++;
      totalPatientsSeeded++;
    }

    summaryReport.push(tenantCounts);
  }

  console.log('\n====================================================');
  console.log('       BULK DEMOGRAPHICS SEEDING COMPLETE           ');
  console.log('====================================================\n');

  console.table(summaryReport);

  console.log(`\n✅ TOTAL STATS:`);
  console.log(`   Total Patients Seeded: ${totalPatientsSeeded}`);
  console.log(`   Total Doctors Seeded: ${totalDoctorsSeeded}`);
  console.log(`   Total Staff Seeded: ${totalStaffSeeded}`);

  process.exit(0);
}

seedBulk().catch(err => {
  console.error('❌ Bulk seeding failed:', err);
  process.exit(1);
});
