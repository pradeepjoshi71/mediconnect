'use strict';

/**
 * pmjayAnalyticsController.js
 * Express endpoint handlers for PM-JAY Dashboard & Analytics reporting.
 */

const { z } = require('zod');
const db = require('../config/db');
const pmjayAnalyticsService = require('../services/pmjayAnalyticsService');
const auditService = require('../services/auditService');
const { asyncHandler } = require('../middlewares/asyncHandler');
const { AppError } = require('../utils/http');

const exportQuerySchema = z.object({
  format: z.enum(['csv', 'pdf']),
});

/**
 * GET /api/v1/pmjay/dashboard/summary
 * Fetch summary stats, status counts, monthly trends, and lists for tables.
 */
const getSummary = asyncHandler(async (req, res) => {
  const hospitalId = req.user.hospitalId;

  // 1. Fetch all dashboard data concurrently
  const [
    claimSummary,
    statusBreakdown,
    revenueMetrics,
    beneficiaryMetrics,
    recentClaims,
    pendingClaimsList,
    rejectedClaimsList
  ] = await Promise.all([
    pmjayAnalyticsService.getClaimSummary(hospitalId),
    pmjayAnalyticsService.getClaimStatusBreakdown(hospitalId),
    pmjayAnalyticsService.getClaimRevenueMetrics(hospitalId),
    pmjayAnalyticsService.getBeneficiaryMetrics(hospitalId),
    db.query(
      `SELECT c.id, c.claim_number AS "claimNumber", c.claim_amount AS "claimAmount", c.status,
              b.pmjay_id AS "pmjayId", b.beneficiary_name AS "beneficiaryName", c.created_at AS "createdAt"
       FROM pmjay_claims c
       JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.tenant_id = $1
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [hospitalId]
    ),
    db.query(
      `SELECT c.id, c.claim_number AS "claimNumber", c.claim_amount AS "claimAmount", c.status,
              b.pmjay_id AS "pmjayId", b.beneficiary_name AS "beneficiaryName", c.submitted_at AS "submittedAt"
       FROM pmjay_claims c
       JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.tenant_id = $1 AND c.status IN ('SUBMITTED', 'UNDER_REVIEW')
       ORDER BY c.created_at DESC
       LIMIT 10`,
      [hospitalId]
    ),
    db.query(
      `SELECT c.id, c.claim_number AS "claimNumber", c.claim_amount AS "claimAmount", c.status,
              b.pmjay_id AS "pmjayId", b.beneficiary_name AS "beneficiaryName", c.rejection_reason AS "rejectionReason", c.updated_at AS "updatedAt"
       FROM pmjay_claims c
       JOIN pmjay_beneficiaries b ON b.id = c.beneficiary_id
       WHERE c.tenant_id = $1 AND c.status = 'REJECTED'
       ORDER BY c.updated_at DESC
       LIMIT 10`,
      [hospitalId]
    )
  ]);

  // 2. Audit access
  await auditService.recordAuditEvent({
    user: req.user,
    action: 'PMJAY_ANALYTICS_VIEWED',
    entityType: 'pmjay_analytics',
    entityId: hospitalId,
    context: req.auditContext,
  });

  res.json({
    summary: {
      totalBeneficiaries: beneficiaryMetrics.totalBeneficiaries,
      totalClaims: claimSummary.totalClaims,
      pendingClaims: claimSummary.pendingClaims,
      approvedClaims: claimSummary.approvedClaims,
      rejectedClaims: claimSummary.rejectedClaims,
      paidClaims: claimSummary.paidClaims,
      totalClaimAmount: claimSummary.totalClaimAmount,
      totalRecoveredRevenue: claimSummary.totalRecoveredRevenue,
    },
    beneficiaryBreakdown: beneficiaryMetrics,
    statusBreakdown,
    revenueMetrics,
    recentClaims: recentClaims.rows,
    pendingClaimsList: pendingClaimsList.rows,
    rejectedClaimsList: rejectedClaimsList.rows,
  });
});

/**
 * GET /api/v1/pmjay/dashboard/export
 * Downloads the PM-JAY claims report as a CSV or PDF file.
 */
const exportReport = asyncHandler(async (req, res) => {
  const { format } = exportQuerySchema.parse(req.query);
  const hospitalId = req.user.hospitalId;

  // Fetch hospital branding/name for PDF header
  let brandingText = 'MediConnect Hospital Management System';
  try {
    const hResult = await db.query('SELECT name FROM hospitals WHERE id = $1 LIMIT 1', [hospitalId]);
    if (hResult.rows[0]?.name) {
      brandingText = hResult.rows[0].name;
    }
  } catch (err) {
    // Ignore and use default
  }

  // Audit export
  await auditService.recordAuditEvent({
    user: req.user,
    action: 'PMJAY_REPORT_EXPORTED',
    entityType: 'pmjay_analytics',
    entityId: hospitalId,
    newValue: { format },
    context: req.auditContext,
  });

  if (format === 'csv') {
    const csvContent = await pmjayAnalyticsService.exportClaimsCsv(hospitalId);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pmjay_claims_report.csv"');
    return res.send(csvContent);
  }

  if (format === 'pdf') {
    const pdfBuffer = await pmjayAnalyticsService.exportClaimsPdf(hospitalId, brandingText);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="pmjay_claims_report.pdf"');
    return res.send(pdfBuffer);
  }

  throw new AppError(400, 'Unsupported export format');
});

module.exports = {
  getSummary,
  exportReport,
};
