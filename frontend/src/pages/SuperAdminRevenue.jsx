import { DollarSign, TrendingUp, BarChart2, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { formatCurrency } from "../utils/formatters";

export default function SuperAdminRevenue() {
  const mrrTrendData = [
    { label: "Jan", count: 250000 },
    { label: "Feb", count: 280000 },
    { label: "Mar", count: 290000 },
    { label: "Apr", count: 320000 },
    { label: "May", count: 350000 },
    { label: "Jun", count: 395000 }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Financial Operations"
        title="Revenue & Analytics Console"
        description="Track Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), and average invoice values across all active medical nodes."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={DollarSign}
          label="Total ARR"
          value={formatCurrency(4740000)}
          helper="Annualized contracts rate"
          accent="brand"
        />
        <StatCard
          icon={TrendingUp}
          label="SaaS MRR"
          value={formatCurrency(395000)}
          helper="+14.2% growth month-over-month"
          accent="teal"
        />
        <StatCard
          icon={ShieldCheck}
          label="Average Order Value"
          value={formatCurrency(131666)}
          helper="Per hospital contract average"
          accent="success"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-1">
        <ChartContainer
          title="MRR Progression (H1 2026)"
          subtitle="Consolidated software platform subscription metrics in INR"
          headerActions={
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Consolidated MRR
            </div>
          }
        >
          <TrendBars
            data={mrrTrendData}
            valueKey="count"
            labelKey="label"
            formatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
        </ChartContainer>
      </div>
    </div>
  );
}
