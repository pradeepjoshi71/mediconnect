'use strict';

const db = require('../config/db');

async function run() {
  console.log('=== CURRENT PILOT DATA SNAPSHOT ===\n');

  const hospitals = await db.query(`
    SELECT h.id, h.code, h.name, h.status,
      (SELECT COUNT(*) FROM users u WHERE u.hospital_id = h.id)::int AS users_count,
      (SELECT COUNT(*) FROM patients p WHERE p.hospital_id = h.id)::int AS patients_count,
      (SELECT COUNT(*) FROM doctors d WHERE d.hospital_id = h.id)::int AS doctors_count
    FROM hospitals h
    ORDER BY h.id
  `);

  console.log(`Found ${hospitals.rows.length} existing hospital(s):`);
  console.table(hospitals.rows);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
