'use strict';

const db = require('../config/db');

async function checkTriggersAndPartitions() {
  try {
    // 1. Get total partition count for audit_logs
    const partRes = await db.query(`
      SELECT count(*) AS partition_count
      FROM pg_inherits i
      JOIN pg_class p ON p.oid = i.inhparent
      WHERE p.relname = 'audit_logs';
    `);
    const partitionCount = parseInt(partRes.rows[0].partition_count, 10);

    // 2. Get triggers on parent table audit_logs
    const parentTrigRes = await db.query(`
      SELECT tgname, tgtype
      FROM pg_trigger
      WHERE tgrelid = 'audit_logs'::regclass AND NOT tgisinternal;
    `);

    // 3. Get total triggers on child partitions
    const childTrigRes = await db.query(`
      SELECT count(*) AS child_trigger_count
      FROM pg_class c
      JOIN pg_inherits i ON i.inhrelid = c.oid
      JOIN pg_class p ON p.oid = i.inhparent
      JOIN pg_trigger t ON t.tgrelid = c.oid
      WHERE p.relname = 'audit_logs' AND NOT t.tgisinternal;
    `);
    const childTriggerCount = parseInt(childTrigRes.rows[0].child_trigger_count, 10);

    console.log(JSON.stringify({
      partitionCount,
      parentTriggers: parentTrigRes.rows.map(r => r.tgname),
      childTriggerCount,
    }, null, 2));

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkTriggersAndPartitions();
