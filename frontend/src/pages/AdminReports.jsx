import { FileText, TrendingUp, Users, Calendar } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { formatCurrency } from "../utils/formatters";

export default function AdminReports() {
  const departmentRevenue = [
    { label: "Cardiology", count: 245000 },
    { label: "Pediatrics", count: 180000 },
    { label: "Orthopedics", count: 320000 },
    { label: "Dermatology", count: 140000 },
    { label: "General Care", count: 95000 }
  ];

  const recentReports = [
    { name: "Monthly Financial Performance Report - May", category: "Finance", generatedBy: "System", date: "2026-06-01" },
    { name: "Doctor Utilization & Consultation Ratios", category: "Operations", generatedBy: "Asha Menon", date: "2026-06-05" },
    { name: "Patient Demographic and Retention Analysis", category: "Patients", generatedBy: "System", date: "2026-06-07" }
  ];

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
          value="450+"
          helper="Registered this quarter"
          accent="brand"
        />
        <StatCard
          icon={Calendar}
          label="Consultation Hours"
          value="1,240 hrs"
          helper="Accumulated clinically"
          accent="teal"
        />
        <StatCard
          icon={TrendingUp}
          label="Avg Visit Cost"
          value={formatCurrency(6500)}
          helper="Consultation fees base"
          accent="success"
        />
        <StatCard
          icon={FileText}
          label="Generated Reports"
          value="24"
          helper="Available in workspace"
          accent="amber"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartContainer
          title="Revenue Share by Department"
          subtitle="Direct consultation fee distributions in INR"
          headerActions={
            <div className="text-[10px] font-bold text-tealish-600 dark:text-tealish-400 bg-tealish-50 dark:bg-tealish-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Weekly share
            </div>
          }
        >
          <TrendBars
            data={departmentRevenue}
            valueKey="count"
            labelKey="label"
            formatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
        </ChartContainer>

        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
            Available Operations Reports
          </h2>
          <PaginatedTable
            rows={recentReports}
            pageSize={5}
            columns={[
              { key: "name", label: "Report Name" },
              { key: "category", label: "Category" },
              { key: "generatedBy", label: "Created By" },
              { key: "date", label: "Generated Date" }
            ]}
          />
        </div>
      </div>
    </div>
  );
}
