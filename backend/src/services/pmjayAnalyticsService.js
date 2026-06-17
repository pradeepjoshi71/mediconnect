'use strict';

/**
 * pmjayAnalyticsService.js
 * Business logic and database queries for PM-JAY Dashboard & Reports.
 */

const db = require('../config/db');
const { buildPdfBuffer } = require('../utils/pdf');

/**
 * Aggregate summary metrics of PM-JAY claims for the hospital/tenant.
 *
 * @param {number} hospitalId
 * @returns {Promise<object>}
 */
async function getClaimSummary(hospitalId) {
  const result = await db.query(
    `SELECT
       COUNT(*)::int AS "totalClaims",
       COUNT(CASE WHEN status IN ('SUBMITTED', 'UNDER_REVIEW') THEN 1 END)::int AS "pendingClaims",
       COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::int AS "approvedClaims",
       COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS "rejectedClaims",
       COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int AS "paidClaims",
       COALESCE(SUM(claim_amount), 0)::numeric AS "totalClaimAmount",
       COALESCE(SUM(CASE WHEN status = 'PAID' THEN claim_amount END), 0)::numeric AS "totalRecoveredRevenue"
     FROM pmjay_claims
     WHERE tenant_id = $1`,
    [hospitalId]
  );
  return result.rows[0];
}

/**
 * Metrics grouped by claim status.
 *
 * @param {number} hospitalId
 * @returns {Promise<Array>}
 */
async function getClaimStatusBreakdown(hospitalId) {
  const result = await db.query(
    `SELECT status,
            COUNT(*)::int AS count,
            COALESCE(SUM(claim_amount), 0)::numeric AS amount
     FROM pmjay_claims
     WHERE tenant_id = $1
     GROUP BY status`,
    [hospitalId]
  );
  return result.rows;
}

/**
 * Monthly trend of claim amounts and recovered revenue.
 *
 * @param {number} hospitalId
 * @returns {Promise<Array>}
 */
async function getClaimRevenueMetrics(hospitalId) {
  const result = await db.query(
    `SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
            COUNT(*)::int AS count,
            COALESCE(SUM(claim_amount), 0)::numeric AS "totalAmount",
            COALESCE(SUM(CASE WHEN status = 'PAID' THEN claim_amount END), 0)::numeric AS "recoveredAmount"
     FROM pmjay_claims
     WHERE tenant_id = $1
     GROUP BY TO_CHAR(created_at, 'YYYY-MM')
     ORDER BY month ASC
     LIMIT 12`,
    [hospitalId]
  );
  return result.rows;
}

/**
 * High-level counts of enrolled beneficiaries.
 *
 * @param {number} hospitalId
 * @returns {Promise<object>}
 */
async function getBeneficiaryMetrics(hospitalId) {
  const result = await db.query(
    `SELECT COUNT(*)::int AS "totalBeneficiaries",
            COUNT(CASE WHEN verification_status = 'verified' THEN 1 END)::int AS "verifiedBeneficiaries",
            COUNT(CASE WHEN eligibility_status = 'eligible' THEN 1 END)::int AS "eligibleBeneficiaries",
            COUNT(CASE WHEN verification_status = 'pending' THEN 1 END)::int AS "pendingVerification"
     FROM pmjay_beneficiaries
     WHERE tenant_id = $1`,
    [hospitalId]
  );
  return result.rows[0];
}

/**
 * Exports all PM-JAY claim rows in the hospital's tenant as a CSV string.
 *
 * @param {number} hospitalId
 * @returns {Promise<string>}
 */
async function exportClaimsCsv(hospitalId) {
  const result = await db.query(
    `SELECT c.claim_number AS "claimNumber",
            b.pmjay_id AS "pmjayId",
            b.beneficiary_name AS "beneficiaryName",
            c.claim_amount AS "claimAmount",
            c.status,
            c.submitted_at AS "submittedAt",
            c.approved_at AS "approvedAt",
            c.paid_at AS "paidAt",
            c.created_at AS "createdAt"
     FROM pmjay_claims c
     JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
     WHERE c.tenant_id = $1
     ORDER BY c.created_at DESC`,
    [hospitalId]
  );

  const csvRows = [];
  csvRows.push("Claim Number,PM-JAY ID,Beneficiary Name,Claim Amount (INR),Status,Submitted At,Approved At,Paid At,Created At");

  for (const row of result.rows) {
    const formattedRow = [
      row.claimNumber,
      row.pmjayId,
      row.beneficiaryName,
      Number(row.claimAmount).toFixed(2),
      row.status,
      row.submittedAt ? new Date(row.submittedAt).toISOString() : "—",
      row.approvedAt  ? new Date(row.approvedAt).toISOString()  : "—",
      row.paidAt      ? new Date(row.paidAt).toISOString()      : "—",
      new Date(row.createdAt).toISOString()
    ];
    csvRows.push(formattedRow.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));
  }

  return csvRows.join("\n");
}

/**
 * Generates a PDF buffer containing the PM-JAY scheme claim report.
 *
 * @param {number} hospitalId
 * @param {string} brandingText
 * @returns {Promise<Buffer>}
 */
async function exportClaimsPdf(hospitalId, brandingText) {
  const [summary, beneficiary, recentResult, rejectedResult] = await Promise.all([
    getClaimSummary(hospitalId),
    getBeneficiaryMetrics(hospitalId),
    db.query(
      `SELECT c.claim_number AS "claimNumber", c.claim_amount AS "claimAmount", c.status, b.beneficiary_name AS "beneficiaryName"
       FROM pmjay_claims c
       JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.tenant_id = $1
       ORDER BY c.created_at DESC
       LIMIT 5`,
      [hospitalId]
    ),
    db.query(
      `SELECT c.claim_number AS "claimNumber", c.claim_amount AS "claimAmount", c.rejection_reason AS "reason"
       FROM pmjay_claims c
       WHERE c.tenant_id = $1 AND c.status = 'REJECTED'
       ORDER BY c.updated_at DESC
       LIMIT 5`,
      [hospitalId]
    )
  ]);

  const sections = [
    {
      heading: "Enrolled Beneficiaries Summary",
      lines: [
        `Total Registered Beneficiaries: ${beneficiary.totalBeneficiaries}`,
        `Verified Beneficiaries: ${beneficiary.verifiedBeneficiaries}`,
        `Eligible Beneficiaries: ${beneficiary.eligibleBeneficiaries}`,
        `Pending Verification: ${beneficiary.pendingVerification}`
      ]
    },
    {
      heading: "Claims Overview & Financial Metrics",
      lines: [
        `Total Claims Filed: ${summary.totalClaims}`,
        `Pending Claims (Submitted / Under Review): ${summary.pendingClaims}`,
        `Approved Claims: ${summary.approvedClaims}`,
        `Rejected Claims: ${summary.rejectedClaims}`,
        `Paid Claims: ${summary.paidClaims}`,
        `Total Claim Amount Filed: INR ${Number(summary.totalClaimAmount).toFixed(2)}`,
        `Total Recovered Revenue: INR ${Number(summary.totalRecoveredRevenue).toFixed(2)}`
      ]
    }
  ];

  if (recentResult.rows.length > 0) {
    const claimsLines = recentResult.rows.map(
      c => `- ${c.claimNumber} | ${c.beneficiaryName} | Amount: INR ${Number(c.claimAmount).toFixed(2)} | Status: ${c.status}`
    );
    sections.push({
      heading: "Recent Claim Submissions",
      lines: claimsLines
    });
  }

  if (rejectedResult.rows.length > 0) {
    const rejectedLines = rejectedResult.rows.map(
      c => `- ${c.claimNumber} | Amount: INR ${Number(c.claimAmount).toFixed(2)} | Reason: ${c.reason || 'None'}`
    );
    sections.push({
      heading: "Recently Rejected Claims",
      lines: rejectedLines
    });
  }

  return buildPdfBuffer({
    title: "PM-JAY Scheme Claims & Analytics Report",
    subtitle: brandingText || "MediConnect Hospital Management System",
    sections
  });
}

module.exports = {
  getClaimSummary,
  getClaimStatusBreakdown,
  getClaimRevenueMetrics,
  getBeneficiaryMetrics,
  exportClaimsCsv,
  exportClaimsPdf,
};
