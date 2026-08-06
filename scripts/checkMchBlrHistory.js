'use strict';

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

const db = require('../backend/src/config/db');

async function runCheck() {
  console.log('=== CHECK 1: HOSPITALS TABLE ROW FOR ID = 2 ===');
  const hospRes = await db.query(`SELECT * FROM hospitals WHERE id = 2`);
  console.log(hospRes.rows[0]);

  console.log('\n=== CHECK 2: USER ACCOUNTS UNDER HOSPITAL_ID = 2 ===');
  const usersRes = await db.query(
    `SELECT u.id, u.email, u.full_name, u.status, u.created_at, r.code AS role
     FROM users u
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE u.hospital_id = 2
     ORDER BY u.id`
  );
  console.table(usersRes.rows);

  console.log('\n=== CHECK 3: AUDIT LOGS FOR HOSPITAL_ID = 2 ===');
  const auditRes = await db.query(
    `SELECT COUNT(*) FROM audit_logs WHERE hospital_id = 2`
  );
  console.log('Audit Logs Count for hospital_id = 2:', auditRes.rows[0].count);

  console.log('\n=== CHECK 4: BACKUP LOGS / RECORDS FOR HOSPITAL_ID = 2 ===');
  const backupLogsRes = await db.query(
    `SELECT COUNT(*) FROM backup_logs`
  );
  console.log('Total Backup Logs Count:', backupLogsRes.rows[0].count);

  process.exit(0);
}

runCheck().catch((err) => {
  console.error(err);
  process.exit(1);
});
