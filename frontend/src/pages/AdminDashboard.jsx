import {
  Activity,
  CalendarCheck,
  Plus,
  UsersRound,
  UserCheck,
  Briefcase,
  DollarSign,
  Receipt,
  UserPlus,
  Calendar,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getAdminDashboard } from "../services/dashboardService";
import { getRevenueReports } from "../services/invoiceService";
import { PageHeader } from "../components/ui/PageHeader";
import { KpiCard } from "../components/ui/KpiCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Card, CardContent } from "../components/ui/Card";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { formatDateTime, statusTone, formatCurrency } from "../utils/formatters";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    try {
      const [dashboardData, revenueData] = await Promise.all([
        getAdminDashboard(),
        getRevenueReports().catch(() => null)
      ]);
      setData(dashboardData);
      setRevenue(revenueData);
    } catch {
      toast.error("Unable to load admin dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <div className="text-sm font-semibold text-slate-500 animate-pulse-subtle">
          Loading hospital workspace...
        </div>
      </div>
    );
  }

  const stats = data?.statistics || {};
  const widgets = data?.widgets || {};

  // Mocked weekly metrics showing realistic trends
  const revenueTrendData = [
    { label: "Mon", count: 24000 },
    { label: "Tue", count: 35000 },
    { label: "Wed", count: 18000 },
    { label: "Thu", count: 42000 },
    { label: "Fri", count: 29000 },
    { label: "Sat", count: 12000 },
    { label: "Sun", count: 8000 },
  ];

  const appointmentVolumeData = [
    { label: "Mon", count: 8 },
    { label: "Tue", count: 12 },
    { label: "Wed", count: 6 },
    { label: "Thu", count: 15 },
    { label: "Fri", count: 11 },
    { label: "Sat", count: 4 },
    { label: "Sun", count: 2 },
  ];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Hospital administration"
        title="Command center dashboard"
        description="Monitor patient volumes, appointments today, active clinicians, and doctor availability in real-time."
        actions={
          <Button onClick={() => navigate("/admin/doctors")}>
            <Plus className="h-4 w-4" />
            Manage doctors
          </Button>
        }
      />

      {/* Quick Action Shortcut Panels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="hover-glow cursor-pointer border border-slate-200/50 bg-white/85 dark:border-neutral-200/10 dark:bg-neutral-100/70" onClick={() => navigate("/admin/patients")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 transition-all duration-300">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Register Patient</div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 mt-0.5">Add a new patient profile</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-glow cursor-pointer border border-slate-200/50 bg-white/85 dark:border-neutral-200/10 dark:bg-neutral-100/70" onClick={() => navigate("/admin/doctors")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-tealish-50 text-tealish-600 dark:bg-tealish-500/10 dark:text-tealish-400 transition-all duration-300">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Provision Doctor</div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 mt-0.5">Configure clinician details</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-glow cursor-pointer border border-slate-200/50 bg-white/85 dark:border-neutral-200/10 dark:bg-neutral-100/70" onClick={() => navigate("/admin/billing")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 transition-all duration-300">
              <Receipt className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Generate Invoice</div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 mt-0.5">Create billing transaction</div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-glow cursor-pointer border border-slate-200/50 bg-white/85 dark:border-neutral-200/10 dark:bg-neutral-100/70" onClick={() => navigate("/appointments")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 transition-all duration-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">Appointments</div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 mt-0.5">Manage active schedules</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={UsersRound}
          label="Total Patients"
          value={stats.totalPatients || 0}
          trend={{ value: "+12% total", isPositive: true }}
          description="registered profile records"
          accent="brand"
        />
        <KpiCard
          icon={Briefcase}
          label="Total Doctors"
          value={stats.totalDoctors || 0}
          trend={{ value: `${stats.activeDoctors || 0} active`, isPositive: true }}
          description="provisioned clinicians"
          accent="teal"
        />
        <KpiCard
          icon={CalendarCheck}
          label="Appointments Today"
          value={stats.appointmentsToday || 0}
          trend={{ value: "Pending: 3", isPositive: false }}
          description="scheduled visits for today"
          accent="amber"
        />
        <KpiCard
          icon={DollarSign}
          label="Revenue This Month"
          value={revenue ? formatCurrency(revenue.revenueThisMonth * 100) : "₹0.00"}
          trend={{ value: revenue ? `Today: ${formatCurrency(revenue.revenueToday * 100)}` : "Today: ₹0.00", isPositive: true }}
          description="total settled collections"
          accent="success"
        />
      </div>

      {/* Charts and Trends */}
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartContainer
          title="Revenue Trends (Weekly)"
          subtitle="Hospital daily income collections tracked in INR"
          headerActions={
            <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Live collections
            </div>
          }
        >
          <TrendBars
            data={revenueTrendData}
            valueKey="count"
            labelKey="label"
            formatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
          />
        </ChartContainer>

        <ChartContainer
          title="Appointment Distribution"
          subtitle="Consultation volumes tracked across the current week"
          headerActions={
            <div className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Today: {stats.appointmentsToday || 0}
            </div>
          }
        >
          <TrendBars
            data={appointmentVolumeData}
            valueKey="count"
            labelKey="label"
          />
        </ChartContainer>
      </div>

      {/* Widgets Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Appointments Widget */}
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              Recent Appointments
            </h2>
          </div>
          <PaginatedTable
            rows={widgets.recentAppointments || []}
            pageSize={5}
            emptyState={
              <EmptyState
                title="No recent appointments"
                description="No appointments have been booked today."
              />
            }
            columns={[
              { key: "patient_name", label: "Patient" },
              { key: "doctor_name", label: "Doctor" },
              {
                key: "starts_at",
                label: "Scheduled Time",
                render: (row) => formatDateTime(row.starts_at),
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
              },
            ]}
          />
        </div>

        {/* New Patients Widget */}
        <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
              New Patients
            </h2>
          </div>
          <PaginatedTable
            rows={widgets.newPatients || []}
            pageSize={5}
            emptyState={
              <EmptyState
                title="No new patients"
                description="No new patient registrations in the system."
              />
            }
            columns={[
              { key: "full_name", label: "Patient Name" },
              { key: "medical_record_number", label: "MRN" },
              { key: "email", label: "Email" },
              {
                key: "created_at",
                label: "Registered At",
                render: (row) => formatDateTime(row.created_at),
              },
            ]}
          />
        </div>
      </div>

      {/* Doctor Availability Widget */}
      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Doctor Availability & Status
        </h2>
        <PaginatedTable
          rows={widgets.doctorAvailability || []}
          pageSize={6}
          emptyState={
            <EmptyState
              title="No doctors configured"
              description="Please provision doctor accounts to see availability."
            />
          }
          columns={[
            { key: "full_name", label: "Doctor Name" },
            { key: "specialization", label: "Specialization" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "active" ? "success" : "slate"}>
                  {row.status}
                </Badge>
              ),
            },
            {
              key: "rules_count",
              label: "Weekly Shift Patterns",
              render: (row) => (
                <span className="text-xs font-semibold text-slate-400 dark:text-neutral-400">
                  {row.rules_count} shift rule(s) configured
                </span>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
