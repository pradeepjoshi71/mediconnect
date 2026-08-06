'use strict';

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

const db = require('../backend/src/config/db');

async function checkSuperAdmin() {
  const res = await db.query(
    `SELECT u.id, u.email, u.full_name, r.code AS role, h.code AS hospital_code
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN hospitals h ON h.id = u.hospital_id
     WHERE r.code IN ('super_admin', 'admin', 'hospital_admin')
     ORDER BY u.id
     LIMIT 10`
  );
  console.log('Super Admin & Admin Users:');
  console.table(res.rows);
  process.exit(0);
}

checkSuperAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
