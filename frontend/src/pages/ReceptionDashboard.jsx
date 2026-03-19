import { CalendarCheck2, ClipboardList, Hourglass, Users } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDashboard } from "../services/dashboardService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

export default function ReceptionDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => toast.error("Unable to load receptionist dashboard"));
  }, []);

  const stats = data?.stats || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={data?.hospital?.code ? `${data.hospital.code} front desk` : "Front desk"}
        title={data?.hospital?.name || "Reception operations"}
        description="Coordinate arrivals, queue flow, waitlists, and day-of-care logistics with live operational visibility."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Patients"
          value={stats.totalPatients || 0}
          helper="Registered in this hospital"
        />
        <StatCard
          icon={CalendarCheck2}
          label="Appointments today"
          value={stats.appointmentsToday || 0}
          helper="Across all clinicians"
          accent="teal"
        />
        <StatCard
          icon={Hourglass}
          label="Open waitlist"
          value={stats.openWaitlist || 0}
          helper="Patients waiting for earlier slots"
          accent="amber"
        />
        <StatCard
          icon={ClipboardList}
          label="Collected revenue"
          value={formatCurrency(stats.revenueCollectedCents || 0)}
          helper="Paid invoices to date"
        />
      </div>

      <PaginatedTable
        rows={data?.predictiveInsights?.appointments || []}
        emptyState={
          <EmptyState
            title="No predictive alerts"
            description="Risk alerts for upcoming appointments will appear here."
          />
        }
        columns={[
          { key: "patientName", label: "Patient" },
          { key: "doctorName", label: "Doctor" },
          {
            key: "scheduledStart",
            label: "Scheduled",
            render: (row) => formatDateTime(row.scheduledStart),
          },
          {
            key: "riskLevel",
            label: "Risk",
            render: (row) => <Badge tone={statusTone(row.riskLevel)}>{row.riskLevel}</Badge>,
          },
          { key: "pendingPayments", label: "Pending payments" },
        ]}
      />

      <PaginatedTable
        rows={data?.appointments || []}
        emptyState={
          <EmptyState
            title="No recent appointments"
            description="Reception activity will appear here as bookings are made."
          />
        }
        columns={[
          { key: "patientName", label: "Patient" },
          { key: "doctorName", label: "Doctor" },
          {
            key: "scheduledStart",
            label: "Scheduled",
            render: (row) => formatDateTime(row.scheduledStart),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
          },
        ]}
      />

      <PaginatedTable
        rows={data?.waitlist || []}
        emptyState={
          <EmptyState
            title="Waitlist is clear"
            description="New waitlist requests will appear here for front-desk follow up."
          />
        }
        columns={[
          { key: "patientName", label: "Patient" },
          { key: "doctorName", label: "Doctor" },
          { key: "preferredDate", label: "Preferred date" },
          {
            key: "priority",
            label: "Priority",
            render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge>,
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
          },
        ]}
      />
    </div>
  );
}
