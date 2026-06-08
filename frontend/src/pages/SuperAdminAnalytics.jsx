import { Cpu, Server, Activity, Disc } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";

export default function SuperAdminAnalytics() {
  const requestMetrics = [
    { label: "00:00", count: 120 },
    { label: "04:00", count: 45 },
    { label: "08:00", count: 320 },
    { label: "12:00", count: 540 },
    { label: "16:00", count: 490 },
    { label: "20:00", count: 280 }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System Performance"
        title="Global Infrastructure Analytics"
        description="Monitor CPU load, active query performance, system network throughput, and tenant database cluster health."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Cpu}
          label="API Latency"
          value="42ms"
          helper="Average backend response delay"
          accent="brand"
        />
        <StatCard
          icon={Server}
          label="Database Load"
          value="18.5%"
          helper="Across RDS postgres cluster"
          accent="teal"
        />
        <StatCard
          icon={Disc}
          label="Log Retention"
          value="3,650d"
          helper="Compliance policy active"
          accent="success"
        />
      </div>

      <div className="grid gap-6">
        <ChartContainer
          title="Consolidated API Traffic (Request Count / Minute)"
          subtitle="Real-time requests aggregated across all tenant networks"
          headerActions={
            <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Live Network
            </div>
          }
        >
          <TrendBars
            data={requestMetrics}
            valueKey="count"
            labelKey="label"
          />
        </ChartContainer>
      </div>
    </div>
  );
}
