import { Building2, CreditCard, DollarSign, Activity } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import hospitalService from "../services/hospitalService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency } from "../utils/formatters";

export default function SuperAdminDashboard() {
  const [hospitals, setHospitals] = useState([]);
  const [stats, setStats] = useState({ totalHospitals: 0, pendingApprovals: 0, activeTenants: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      hospitalService.listHospitals(),
      hospitalService.getApplicationStats()
    ])
      .then(([hospitalsData, statsData]) => {
        setHospitals(hospitalsData.hospitals || []);
        setStats(statsData.stats || { totalHospitals: 0, pendingApprovals: 0, activeTenants: 0 });
      })
      .catch((err) => {
        toast.error("Failed to load dashboard data");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="System Administration"
        title="Super Admin command center"
        description="Monitor system-wide multi-tenant tenants, SaaS subscriptions, revenue stats, and support tickets."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Building2}
          label="Total Hospitals"
          value={stats.totalHospitals}
          helper="Multi-tenant databases"
          accent="brand"
        />
        <StatCard
          icon={CreditCard}
          label="Pending Approvals"
          value={stats.pendingApprovals}
          helper="Onboarding requests"
          accent="amber"
        />
        <StatCard
          icon={Activity}
          label="Active Tenants"
          value={stats.activeTenants}
          helper="Actively operating nodes"
          accent="teal"
        />
        <StatCard
          icon={DollarSign}
          label="Monthly Revenue"
          value={formatCurrency(stats.totalHospitals * 49900)}
          helper="Estimated MRR"
          accent="success"
        />
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Active Hospital Tenants
        </h2>
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="text-sm font-semibold text-slate-500 animate-pulse-subtle">
              Loading active tenants...
            </div>
          </div>
        ) : (
          <PaginatedTable
            rows={hospitals}
            pageSize={5}
            emptyState={
              <EmptyState
                title="No hospitals registered"
                description="No active hospital tenants exist in the system."
              />
            }
            columns={[
              { key: "name", label: "Hospital Name" },
              {
                key: "code",
                label: "Tenant Code",
                render: (row) => (
                  <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">
                    {row.code}
                  </span>
                )
              },
              { key: "country_code", label: "Country" },
              { key: "timezone", label: "Timezone" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "active" ? "success" : "slate"}>
                    {row.status}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
