import {
  Activity,
  CalendarCheck,
  Plus,
  UsersRound,
  UserCheck,
  Briefcase,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getAdminDashboard } from "../services/dashboardService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDateTime, statusTone } from "../utils/formatters";
import { useNavigate } from "react-router-dom";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  async function load() {
    try {
      const dashboardData = await getAdminDashboard();
      setData(dashboardData);
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
        <div className="text-sm font-semibold text-slate-500">Loading dashboard...</div>
      </div>
    );
  }

  const stats = data?.statistics || {};
  const widgets = data?.widgets || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Hospital administration"
        title="Command center dashboard"
        description="Monitor patient volumes, appointments today, active clinicians, and doctor availability in real-time."
        actions={
          <Button onClick={() => navigate("/doctors-list")}>
            <Plus className="h-4 w-4" />
            Manage doctors
          </Button>
        }
      />

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={UsersRound}
          label="Total Patients"
          value={stats.totalPatients || 0}
          helper="Registered patient profiles"
        />
        <StatCard
          icon={Briefcase}
          label="Total Doctors"
          value={stats.totalDoctors || 0}
          helper="Total provisioned clinicians"
          accent="teal"
        />
        <StatCard
          icon={CalendarCheck}
          label="Appointments Today"
          value={stats.appointmentsToday || 0}
          helper="Booked appointments for today"
          accent="amber"
        />
        <StatCard
          icon={UserCheck}
          label="Active Doctors"
          value={stats.activeDoctors || 0}
          helper="Clinicians active and ready"
          accent="green"
        />
      </div>

      {/* Widgets Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Appointments Widget */}
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
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
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
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
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <h2 className="mb-4 text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
          Doctor Availability & Status
        </h2>
        <PaginatedTable
          rows={widgets.doctorAvailability || []}
          pageSize={10}
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
                <Badge tone={row.status === "active" ? "green" : "slate"}>
                  {row.status}
                </Badge>
              ),
            },
            {
              key: "rules_count",
              label: "Weekly Shift Patterns",
              render: (row) => (
                <span className="text-sm text-slate-500 dark:text-slate-400">
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
