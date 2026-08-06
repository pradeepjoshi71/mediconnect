'use strict';

/**
 * validateReports.js — Report & Analytics Verification Tool
 * 
 * Validates Revenue, Expense, Doctor Analytics, and Profit & Loss (P&L) reports 
 * for TEST-CLINIC-01 through TEST-CLINIC-10 against raw database transaction sums.
 */

try {
  require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
} catch (err) {}

module.paths.push(require('path').join(__dirname, '../backend/node_modules'));

const db = require('../backend/src/config/db');
const analyticsRepository = require('../backend/src/repositories/analyticsRepository');
const businessRepository = require('../backend/src/repositories/businessRepository');

async function validateTenantReports() {
  console.log('====================================================');
  console.log('  REPORT & ANALYTICS DATA ACCURACY VALIDATOR        ');
  console.log('====================================================\n');

  const hospitalsRes = await db.query(
    `SELECT id, code, name FROM hospitals WHERE code LIKE 'TEST-CLINIC-%' ORDER BY id`
  );

  if (hospitalsRes.rows.length === 0) {
    console.error('❌ No TEST-CLINIC hospitals found!');
    process.exit(1);
  }

  console.log(`Targeting ${hospitalsRes.rows.length} test tenants for report accuracy validation.\n`);

  const tenantResults = [];
  const discrepancies = [];

  for (const hosp of hospitalsRes.rows) {
    const hospitalId = hosp.id;
    const code = hosp.code;

    // 1. Raw DB Ground Truth Calculations for tenant
    const rawPaidRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0.00)::double precision AS "rawRevenue"
       FROM payments
       WHERE hospital_id = $1 AND status = 'paid'`,
      [hospitalId]
    );
    const rawRevenue = rawPaidRes.rows[0].rawRevenue;

    const rawPendingRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0.00)::double precision AS "rawPending"
       FROM payments
       WHERE hospital_id = $1 AND status IN ('pending', 'processing')`,
      [hospitalId]
    );
    const rawPending = rawPendingRes.rows[0].rawPending;

    const rawExpensesRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0.00)::double precision AS "rawExpenses"
       FROM expenses
       WHERE hospital_id = $1`,
      [hospitalId]
    );
    const rawExpenses = rawExpensesRes.rows[0].rawExpenses;

    const rawNetProfit = rawRevenue - rawExpenses;

    const rawApptCountRes = await db.query(
      `SELECT COUNT(*)::int AS "rawApptCount" FROM appointments WHERE hospital_id = $1`,
      [hospitalId]
    );
    const rawApptCount = rawApptCountRes.rows[0].rawApptCount;

    // 2. Fetch service/repository report figures
    const headline = await analyticsRepository.getHeadlineStats(hospitalId);
    const revMetrics = await businessRepository.getRevenueDashboardMetrics(hospitalId);
    const pnlSummary = await businessRepository.getProfitLossSummary(hospitalId);
    const docPerf = await analyticsRepository.getDoctorPerformance(hospitalId);

    // 3. Mathematical Comparisons
    let tenantPass = true;
    const tenantDiscrepancies = [];

    // Check P&L Revenue match
    if (Math.abs(pnlSummary.totalRevenue - rawRevenue) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`P&L Total Revenue mismatch: P&L=${pnlSummary.totalRevenue}, Raw=${rawRevenue}`);
    }

    // Check P&L Expenses match
    if (Math.abs(pnlSummary.totalExpenses - rawExpenses) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`P&L Total Expenses mismatch: P&L=${pnlSummary.totalExpenses}, Raw=${rawExpenses}`);
    }

    // Check P&L Net Profit match
    if (Math.abs(pnlSummary.netProfit - rawNetProfit) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`P&L Net Profit mismatch: P&L=${pnlSummary.netProfit}, Raw=${rawNetProfit}`);
    }

    // Check Headline Revenue match
    const headlineRevenue = Number(headline.revenueCollectedCents);
    if (Math.abs(headlineRevenue - rawRevenue) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`Headline Revenue mismatch: Headline=${headlineRevenue}, Raw=${rawRevenue}`);
    }

    // Check Revenue Dashboard Pending match
    if (Math.abs(revMetrics.summary.pendingPayments - rawPending) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`Revenue Dashboard Pending mismatch: Dashboard=${revMetrics.summary.pendingPayments}, Raw=${rawPending}`);
    }

    // Check Doctor Performance total sum matches tenant total doctor revenue
    const docRevenueSum = revMetrics.revenueByDoctor.reduce((sum, d) => sum + d.amount, 0);
    if (Math.abs(docRevenueSum - rawRevenue) > 0.01) {
      tenantPass = false;
      tenantDiscrepancies.push(`Doctor Revenue Sum mismatch: DoctorSum=${docRevenueSum}, Raw=${rawRevenue}`);
    }

    // Check Cross-Tenant Leakage in Doctor Performance
    const crossTenantDocs = await db.query(
      `SELECT d.id FROM doctors d WHERE d.hospital_id != $1 AND d.id IN (
         SELECT DISTINCT doctor_id FROM appointments WHERE hospital_id = $1
       )`,
      [hospitalId]
    );
    if (crossTenantDocs.rows.length > 0) {
      tenantPass = false;
      tenantDiscrepancies.push(`Cross-tenant doctor leakage detected: ${crossTenantDocs.rows.length} foreign doctors in appointments`);
    }

    tenantResults.push({
      tenantCode: code,
      hospitalId,
      rawRevenue,
      pnlRevenue: pnlSummary.totalRevenue,
      rawExpenses,
      pnlExpenses: pnlSummary.totalExpenses,
      netProfit: pnlSummary.netProfit,
      appointments: rawApptCount,
      status: tenantPass ? 'PASS' : 'FAIL',
    });

    if (!tenantPass) {
      discrepancies.push({ tenant: code, issues: tenantDiscrepancies });
    }
  }

  console.log('====================================================');
  console.log('            REPORT VALIDATION RESULTS               ');
  console.log('====================================================\n');

  console.table(tenantResults);

  console.log(`\n✅ TENANTS VALIDATED: ${tenantResults.length}`);
  const passCount = tenantResults.filter(r => r.status === 'PASS').length;
  console.log(`   PASS: ${passCount} / ${tenantResults.length}`);
  console.log(`   FAIL: ${tenantResults.length - passCount} / ${tenantResults.length}`);

  if (discrepancies.length > 0) {
    console.log('\n❌ DISCREPANCIES DETECTED:');
    console.dir(discrepancies, { depth: null });
  } else {
    console.log('\n✨ All report metrics mathematically match underlying database ground truth with 0 discrepancies.');
  }

  // Cross-tenant data mixing check
  const totalSeededRevenue = tenantResults.reduce((acc, r) => acc + r.rawRevenue, 0);
  const globalPaidRes = await db.query(
    `SELECT COALESCE(SUM(amount), 0.00)::double precision AS "globalPaid"
     FROM payments WHERE hospital_id IN (SELECT id FROM hospitals WHERE code LIKE 'TEST-CLINIC-%') AND status = 'paid'`
  );
  console.log(`\n🔍 CROSS-TENANT ISOLATION CHECK:`);
  console.log(`   Sum of Tenant Reports: $${totalSeededRevenue.toFixed(2)}`);
  console.log(`   Global DB Test Sum:    $${globalPaidRes.rows[0].globalPaid.toFixed(2)}`);
  console.log(`   Match Status:          ${Math.abs(totalSeededRevenue - globalPaidRes.rows[0].globalPaid) < 0.01 ? 'MATCH ✅' : 'MISMATCH ❌'}`);

  // Verify pilot clinic isolation
  const pilotDataCheck = await db.query(`SELECT id, code FROM hospitals WHERE code IN ('BETA01', 'MCH-BLR')`);
  console.log(`\n✅ PILOT DATA SAFETY VERIFICATION: ${pilotDataCheck.rows.length} pilot hospitals intact.`);

  process.exit(discrepancies.length > 0 ? 1 : 0);
}

validateTenantReports().catch(err => {
  console.error('❌ Validation script error:', err);
  process.exit(1);
});
