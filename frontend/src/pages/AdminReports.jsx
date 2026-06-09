import { FileText, TrendingUp, Users, Calendar, Loader2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { formatCurrency } from "../utils/formatters";
import { useState, useEffect } from "react";
import { getAnalyticsOverview } from "../services/analyticsService";
import toast from "react-hot-toast";

export default function AdminReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getAnalyticsOverview();
        setData(res);
      } catch (err) {
        toast.error("Unable to load analytics reports");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-2 text-sm text-slate-500">Loading reports console...</span>
      </div>
    );
  }

  const headline = data?.headline || {};
  const revenueTrend = (data?.revenueSeries || []).map((item) => ({
    label: item.label,
    count: item.amountCents / 100,
  }));

  const doctorPerformance = (data?.doctorPerformance || []).map((doc) => ({
    name: doc.doctorName,
    specialty: doc.specialization,
    completed: doc.completedAppointments,
    revenue: formatCurrency(doc.revenueCents),
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Hospital Insights"
        title="Reports & Analytics Console"
        description="Extract compiled department metrics, doctor consultation logs, and billing settlement reports."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Active Patients"
          value={headline.totalPatients || 0}
          helper="Registered hospital patients"
          accent="brand"
        />
        <StatCard
          icon={Calendar}
          label="Appointments Today"
          value={headline.appointmentsToday || 0}
          helper="Scheduled for today"
          accent="teal"
        />
        <StatCard
          icon={TrendingUp}
          label="Outstanding Bills"
          value={formatCurrency(headline.outstandingRevenueCents || 0)}
          helper="Pending/processing invoices"
          accent="success"
        />
        <StatCard
          icon={FileText}
          label="Revenue Collected"
          value={formatCurrency(headline.revenueCollectedCents || 0)}
          helper="Settled invoices total"
          accent="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartContainer
          title="Daily Revenue Trend"
          subtitle="Direct payment settlements collected in last 7 days"
          headerActions={
            <div className="text-[10px] font-bold text-tealish-600 dark:text-tealish-400 bg-tealish-50 dark:bg-tealish-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Weekly share
            </div>
          }
        >
          <TrendBars
            data={revenueTrend}
            valueKey="count"
            labelKey="label"
            formatter={(val) => `₹${val.toLocaleString()}`}
          />
        </ChartContainer>

        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Available Clinician Performance
          </h2>
          <PaginatedTable
            rows={doctorPerformance}
            pageSize={5}
            columns={[
              { key: "name", label: "Clinician Name" },
              { key: "specialty", label: "Specialization" },
              { key: "completed", label: "Visits Completed" },
              { key: "revenue", label: "Revenue Earned" }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
