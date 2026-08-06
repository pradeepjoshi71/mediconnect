'use strict';

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

const db = require('../backend/src/config/db');

async function runInvestigation() {
  const allHospitalsRes = await db.query(`
    SELECT 
      h.id, 
      h.code, 
      h.name, 
      (SELECT COUNT(*) FROM patients p WHERE p.hospital_id = h.id) AS patients,
      (SELECT COUNT(*) FROM doctors d WHERE d.hospital_id = h.id) AS doctors,
      (SELECT COUNT(*) FROM appointments a WHERE a.hospital_id = h.id) AS appointments,
      (SELECT COUNT(*) FROM invoices i WHERE i.hospital_id = h.id) AS invoices
    FROM hospitals h
    ORDER BY h.id
  `);

  console.log('Hospital Data Distribution across all tenants:');
  console.table(allHospitalsRes.rows);
  process.exit(0);
}

runInvestigation().catch((err) => {
  console.error(err);
  process.exit(1);
});
