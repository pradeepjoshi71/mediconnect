const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function run() {
  const sqlPath = path.join(__dirname, '../../../database/migrations/011_hospital_applications.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  console.log('Running migration: 011_hospital_applications.sql...');
  try {
    await db.query(sql);
    console.log('Migration successfully applied.');
    process.exit(0);
  } catch (err) {
    console.error('Error applying migration:', err);
    process.exit(1);
  }
}

run();
