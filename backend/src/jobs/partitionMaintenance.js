'use strict';

const cron = require('node-cron');
const db = require('../config/db');
const logger = require('../utils/logger');

let _cronJob = null;

/**
 * Ensures PostgreSQL partition for audit_logs exists for a target date (defaults to next month).
 */
async function ensureMonthPartition(date = new Date()) {
  const target = new Date(date.getFullYear(), date.getMonth(), 1);
  const year = target.getUTCFullYear();
  const month = target.getUTCMonth() + 1; // 1-indexed

  const nextTarget = new Date(Date.UTC(year, month, 1));
  const nextYear = nextTarget.getUTCFullYear();
  const nextMonth = nextTarget.getUTCMonth() + 1;

  const partName = `audit_logs_y${year}m${String(month).padStart(2, '0')}`;
  const startDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00+00`;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00+00`;

  try {
    const queryText = `
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = ${db.pool.escapeLiteral ? db.pool.escapeLiteral(partName) : `'${partName}'`}
        ) THEN
          EXECUTE 'CREATE TABLE IF NOT EXISTS ' || quote_ident('${partName}') ||
                  ' PARTITION OF audit_logs FOR VALUES FROM (${db.pool.escapeLiteral ? db.pool.escapeLiteral(startDate) : `'${startDate}'`}) TO (${db.pool.escapeLiteral ? db.pool.escapeLiteral(endDate) : `'${endDate}'`})';
        END IF;
      END $$;
    `;

    await db.query(
      `
        CREATE TABLE IF NOT EXISTS ${partName} PARTITION OF audit_logs
        FOR VALUES FROM ($1) TO ($2);
      `,
      [startDate, endDate]
    ).catch(async () => {
      // Fallback in case table already exists or default partition handles it
      await db.query(queryText).catch(() => {});
    });

    logger.info(`Partition check/creation completed for ${partName}`, { partName, startDate, endDate });
    return partName;
  } catch (error) {
    logger.warn(`Partition maintenance note for ${partName}: ${error.message}`);
    return null;
  }
}

/**
 * Ensures partitions exist for current month, next month, and month after next.
 */
async function runMaintenance() {
  const now = new Date();
  const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const monthAfterNext = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 2, 1));

  await ensureMonthPartition(currentMonth);
  await ensureMonthPartition(nextMonth);
  await ensureMonthPartition(monthAfterNext);
}

/**
 * Starts daily partition maintenance cron at 00:10 UTC.
 */
function start() {
  if (_cronJob) return;

  // Run on startup
  runMaintenance().catch((err) => {
    logger.warn('Initial partition maintenance failed', { error: err.message });
  });

  // Schedule daily at 00:10 UTC
  _cronJob = cron.schedule('10 0 * * *', async () => {
    logger.info('Running scheduled audit_logs partition maintenance job...');
    await runMaintenance();
  });

  logger.info('Audit log partition maintenance scheduler started');
}

/**
 * Stops partition maintenance cron job.
 */
function stop() {
  if (_cronJob) {
    _cronJob.stop();
    _cronJob = null;
    logger.info('Audit log partition maintenance scheduler stopped');
  }
}

module.exports = {
  start,
  stop,
  runMaintenance,
  ensureMonthPartition,
};
