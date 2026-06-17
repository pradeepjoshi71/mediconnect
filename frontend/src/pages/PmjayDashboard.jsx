import { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  TrendingUp,
  AlertCircle,
  Clock,
  Download,
  DollarSign,
  Users,
  Loader2
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { formatCurrency, formatDateTime } from "../utils/formatters";
import toast from "react-hot-toast";
import {
  getClaimsDashboardSummary,
  exportClaimsReport
} from "../services/pmjayAnalyticsService";

export default function PmjayDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const summaryData = await getClaimsDashboardSummary();
      setData(summaryData);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load PM-JAY dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleExport = async (format) => {
    if (format === "csv") setExportingCsv(true);
    if (format === "pdf") setExportingPdf(true);
    try {
      await exportClaimsReport(format);
      toast.success(`PM-JAY claims report (${format.toUpperCase()}) exported successfully`);
    } catch (err) {
      toast.error(`Failed to export PM-JAY report as ${format.toUpperCase()}`);
    } finally {
      if (format === "csv") setExportingCsv(false);
      if (format === "pdf") setExportingPdf(false);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-brand-600" />
          <p className="text-sm font-semibold text-slate-500 dark:text-neutral-400">Loading PM-JAY analytics dashboard...</p>
        </div>
      </div>
    );
  }

  const {
    summary,
    beneficiaryBreakdown,
    statusBreakdown = [],
    revenueMetrics = [],
    recentClaims = [],
    pendingClaimsList = [],
    rejectedClaimsList = []
  } = data;

  // Find max count for status progress bar sizing
  const maxStatusCount = Math.max(...statusBreakdown.map(s => s.count), 1);

  const STATUS_DETAILS = {
    DRAFT: { label: "Draft", color: "bg-slate-400 dark:bg-neutral-600" },
    SUBMITTED: { label: "Submitted", color: "bg-blue-500" },
    UNDER_REVIEW: { label: "Under Review", color: "bg-amber-500" },
    APPROVED: { label: "Approved", color: "bg-emerald-500" },
    REJECTED: { label: "Rejected", color: "bg-red-500" },
    PAID: { label: "Paid", color: "bg-teal-500" }
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Scheme Management"
        title="PM-JAY Claims & Analytics Console"
        description="Monitor Ayushman Bharat PM-JAY beneficiary enrollment, track claims submissions, and review financial recovery trends."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => handleExport("csv")}
              loading={exportingCsv}
              disabled={exportingPdf}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="primary"
              onClick={() => handleExport("pdf")}
              loading={exportingPdf}
              disabled={exportingCsv}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl"
            >
              <FileText className="mr-2 h-4 w-4" />
              Download PDF Report
            </Button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="PM-JAY Enrolled"
          value={summary.totalBeneficiaries}
          helper={`${beneficiaryBreakdown.verifiedBeneficiaries} verified cardholders`}
          accent="brand"
        />
        <StatCard
          icon={FileText}
          label="Total Claims"
          value={summary.totalClaims}
          helper={`₹${Number(summary.totalClaimAmount).toLocaleString("en-IN")}`}
          accent="teal"
        />
        <StatCard
          icon={Clock}
          label="Claims Pending"
          value={summary.pendingClaims}
          helper="Awaiting scheme review"
          accent="amber"
        />
        <StatCard
          icon={AlertCircle}
          label="Claims Rejected"
          value={summary.rejectedClaims}
          helper="Requires corrections"
          accent="danger"
        />
        <StatCard
          icon={TrendingUp}
          label="Revenue Recovered"
          value={formatCurrency(summary.totalRecoveredRevenue)}
          helper={`${summary.paidClaims} paid settlements`}
          accent="success"
        />
      </div>

      {/* Charts Block */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Claim Status Distribution (Horizontal custom bars) */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-950/85">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">Claim Status Distribution</h3>
          <p className="text-xs text-slate-400 dark:text-neutral-500 mb-6">Breakdown of all claim statuses in the system</p>
          
          <div className="space-y-4">
            {statusBreakdown.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-12">No claims filed yet</p>
            ) : (
              statusBreakdown.map((item) => {
                const config = STATUS_DETAILS[item.status] || { label: item.status, color: "bg-slate-400" };
                const pct = (item.count / maxStatusCount) * 100;
                return (
                  <div key={item.status} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-350">
                      <span>{config.label}</span>
                      <span className="font-bold">
                        {item.count} claim{item.count !== 1 ? "s" : ""} (₹{Number(item.amount).toLocaleString("en-IN")})
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                      <div
                        className={`${config.color} h-full rounded-full transition-all duration-500`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly Submission Trend */}
        <ChartContainer
          title="Monthly Claim Trend"
          subtitle="Volume of claims submitted over the last 12 months"
          className="lg:col-span-1"
        >
          {revenueMetrics.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-12">No data available</p>
          ) : (
            <TrendBars
              data={revenueMetrics}
              valueKey="count"
              labelKey="month"
              formatter={(val) => `${val}`}
            />
          )}
        </ChartContainer>

        {/* Revenue Recovery Trend */}
        <ChartContainer
          title="Revenue Recovery Trend"
          subtitle="Total settled claim amounts recovered per month"
          className="lg:col-span-1"
        >
          {revenueMetrics.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-12">No data available</p>
          ) : (
            <TrendBars
              data={revenueMetrics}
              valueKey="recoveredAmount"
              labelKey="month"
              formatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
            />
          )}
        </ChartContainer>
      </div>

      {/* Tables Breakdown */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Pending & Under Review Claims */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-950/85">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            Claims Pending Review
          </h3>
          <PaginatedTable
            rows={pendingClaimsList.map((claim) => ({
              ...claim,
              amount: `₹${Number(claim.claimAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              submitted: claim.submittedAt ? formatDateTime(claim.submittedAt) : "—",
              statusBadge: (
                <Badge tone={claim.status === "UNDER_REVIEW" ? "yellow" : "blue"}>
                  {claim.status.replace(/_/g, " ")}
                </Badge>
              )
            }))}
            pageSize={5}
            columns={[
              { key: "claimNumber", label: "Claim No." },
              { key: "beneficiaryName", label: "Beneficiary" },
              { key: "amount", label: "Amount" },
              { key: "submitted", label: "Submitted At" },
              { key: "statusBadge", label: "Status" }
            ]}
          />
        </div>

        {/* Rejected Claims */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-950/85">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Rejected Claims
          </h3>
          <PaginatedTable
            rows={rejectedClaimsList.map((claim) => ({
              ...claim,
              amount: `₹${Number(claim.claimAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              updated: claim.updatedAt ? formatDateTime(claim.updatedAt) : "—",
              reason: claim.rejectionReason || "No reason specified",
              statusBadge: <Badge tone="red">REJECTED</Badge>
            }))}
            pageSize={5}
            columns={[
              { key: "claimNumber", label: "Claim No." },
              { key: "beneficiaryName", label: "Beneficiary" },
              { key: "amount", label: "Amount" },
              { key: "reason", label: "Rejection Reason" },
              { key: "updated", label: "Rejected At" }
            ]}
          />
        </div>

        {/* Recent Claims (Full list preview) */}
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-premium dark:border-slate-800 dark:bg-slate-950/85 xl:col-span-2">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <FileText className="h-5 w-5 text-brand-500" />
            Recent Claim Filings
          </h3>
          <PaginatedTable
            rows={recentClaims.map((claim) => ({
              ...claim,
              amount: `₹${Number(claim.claimAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`,
              created: claim.createdAt ? formatDateTime(claim.createdAt) : "—",
              statusBadge: (
                <Badge
                  tone={
                    claim.status === "PAID"         ? "teal"    :
                    claim.status === "APPROVED"     ? "teal"    :
                    claim.status === "REJECTED"     ? "red"     :
                    claim.status === "UNDER_REVIEW" ? "yellow"  :
                    claim.status === "SUBMITTED"    ? "blue"    : "neutral"
                  }
                >
                  {claim.status}
                </Badge>
              )
            }))}
            pageSize={5}
            columns={[
              { key: "claimNumber", label: "Claim No." },
              { key: "pmjayId", label: "PM-JAY ID" },
              { key: "beneficiaryName", label: "Beneficiary" },
              { key: "amount", label: "Claim Amount" },
              { key: "created", label: "Created At" },
              { key: "statusBadge", label: "Status" }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
