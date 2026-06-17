import api from "./apiClient";
import { downloadProtectedFile } from "./downloadService";

// ─── PM-JAY Analytics and Dashboard API ──────────────────────────────────────

/**
 * Fetch PM-JAY claims dashboard summary data.
 * Returns: { summary, beneficiaryBreakdown, statusBreakdown, revenueMetrics, recentClaims, pendingClaimsList, rejectedClaimsList }
 */
export async function getClaimsDashboardSummary() {
  const response = await api.get("/pmjay/dashboard/summary");
  return response.data;
}

/**
 * Trigger file download for PM-JAY claims report.
 * @param {'csv' | 'pdf'} format
 */
export async function exportClaimsReport(format) {
  await downloadProtectedFile(`/pmjay/dashboard/export?format=${format}`, `pmjay_claims_report.${format}`);
}
