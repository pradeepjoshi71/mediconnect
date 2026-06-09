import { Cpu, Server, Activity, Disc, Loader2, Building2, UsersRound } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { useState, useEffect } from "react";
import systemHealthService from "../services/systemHealthService";
import toast from "react-hot-toast";

export default function SuperAdminAnalytics() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await systemHealthService.getMonitoring();
        setMetrics(res.metrics);
      } catch (err) {
        toast.error("Failed to load global metrics");
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
        <span className="ml-2 text-sm text-slate-500">Loading infrastructure analytics...</span>
      </div>
    );
  }

  const requestMetrics = [
    { label: "Patients", count: metrics?.totalPatients || 0 },
    { label: "Doctors", count: metrics?.totalDoctors || 0 },
    { label: "Appointments", count: metrics?.totalAppointments || 0 }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System Performance"
        title="Global Infrastructure Analytics"
        description="Monitor active tenants, database capacity, platform user counts, and overall data metrics in real-time."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Building2}
          label="Active Tenants"
          value={metrics?.activeTenants || 0}
          helper="Hospitals currently on active/trial status"
          accent="brand"
        />
        <StatCard
          icon={UsersRound}
          label="Active Users"
          value={metrics?.activeUsers || 0}
          helper="Logged-in and active users"
          accent="teal"
        />
        <StatCard
          icon={Disc}
          label="Storage Usage"
          value={`${metrics?.storageUsage?.totalFiles || 0} files`}
          helper={`MinIO bucket connection: ${metrics?.storageUsage?.status || "unknown"}`}
          accent="success"
        />
      </div>

      <div className="grid gap-6">
        <ChartContainer
          title="Consolidated Platform Volumes"
          subtitle="Real-time counts aggregated across all tenant networks"
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
