import { Activity, BarChart3, CreditCard, Plus, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDashboard } from "../services/dashboardService";
import { getAnalyticsOverview } from "../services/analyticsService";
import { createStaff, listUsers } from "../services/adminService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { TrendBars } from "../components/ui/TrendBars";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

const initialStaff = {
  fullName: "",
  email: "",
  password: "",
  phone: "",
  role: "doctor",
  specialization: "",
  department: "General Medicine",
  experienceYears: 5,
  consultationFeeCents: 5000,
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(initialStaff);
  const [creating, setCreating] = useState(false);

  async function load() {
    try {
      const [dashboardData, analyticsData, usersData] = await Promise.all([
        getDashboard(),
        getAnalyticsOverview(),
        listUsers(),
      ]);
      setDashboard(dashboardData);
      setAnalytics(analyticsData);
      setUsers(usersData);
    } catch {
      toast.error("Unable to load admin dashboard");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submitStaff(event) {
    event.preventDefault();
    setCreating(true);
    try {
      await createStaff({
        ...staffForm,
        experienceYears: Number(staffForm.experienceYears) || 0,
        consultationFeeCents: Number(staffForm.consultationFeeCents) || 0,
      });
      toast.success("Staff member created");
      setOpen(false);
      setStaffForm(initialStaff);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create staff member");
    } finally {
      setCreating(false);
    }
  }

  const headline = analytics?.headline || dashboard?.stats || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Hospital administration"
        title="Enterprise operations dashboard"
        description="Monitor patient volumes, clinician throughput, revenue, and staffing from one executive command center."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" />
            Add doctor or receptionist
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={UsersRound} label="Patients" value={headline.totalPatients || 0} helper="Registered patient profiles" />
        <StatCard icon={Activity} label="Doctors" value={headline.totalDoctors || 0} helper="Provisioned clinicians" accent="teal" />
        <StatCard icon={BarChart3} label="Appointments today" value={headline.appointmentsToday || 0} helper="Booked across the network" accent="amber" />
        <StatCard icon={CreditCard} label="Revenue collected" value={formatCurrency(headline.revenueCollectedCents || 0)} helper="Paid invoices" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <TrendBarsCard
          title="Appointments over the last 7 days"
          data={analytics?.appointmentSeries || []}
          valueKey="count"
          emptyTitle="No appointment activity"
          emptyDescription="Trends will appear once bookings are created."
        />
        <TrendBarsCard
          title="Revenue over the last 7 days"
          data={analytics?.revenueSeries || []}
          valueKey="amountCents"
          formatter={(value) => `₹${Math.round(value / 100)}`}
          emptyTitle="No revenue trend yet"
          emptyDescription="Paid invoices will populate the revenue chart."
        />
      </div>

      <PaginatedTable
        rows={analytics?.doctorPerformance || []}
        emptyState={<EmptyState title="No clinician performance data" description="Completed consultations will populate this table." />}
        columns={[
          { key: "doctorName", label: "Doctor" },
          { key: "specialization", label: "Specialization" },
          { key: "completedAppointments", label: "Completed visits" },
          { key: "rating", label: "Rating", render: (row) => <Badge tone="brand">{row.rating}</Badge> },
          { key: "revenueCents", label: "Revenue", render: (row) => formatCurrency(row.revenueCents) },
        ]}
      />

      <PaginatedTable
        rows={users}
        emptyState={<EmptyState title="No users found" description="Staff and patient accounts will appear here." />}
        columns={[
          { key: "fullName", label: "User" },
          { key: "email", label: "Email" },
          { key: "role", label: "Role", render: (row) => <Badge tone={statusTone(row.role)}>{row.role}</Badge> },
          { key: "createdAt", label: "Created", render: (row) => formatDateTime(row.createdAt) },
        ]}
      />

      <PaginatedTable
        rows={dashboard?.waitlist || []}
        emptyState={<EmptyState title="Waitlist is clear" description="No pending waitlist requests at the moment." />}
        columns={[
          { key: "patientName", label: "Patient" },
          { key: "doctorName", label: "Doctor" },
          { key: "preferredDate", label: "Preferred date" },
          { key: "priority", label: "Priority", render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge> },
          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
        ]}
      />

      <Modal open={open} onClose={() => setOpen(false)} title="Provision staff account">
        <form onSubmit={submitStaff} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Full name" value={staffForm.fullName} onChange={(event) => setStaffForm((current) => ({ ...current, fullName: event.target.value }))} />
            <Input type="email" placeholder="Email" value={staffForm.email} onChange={(event) => setStaffForm((current) => ({ ...current, email: event.target.value }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Input placeholder="Phone" value={staffForm.phone} onChange={(event) => setStaffForm((current) => ({ ...current, phone: event.target.value }))} />
            <Input type="password" placeholder="Temporary password" value={staffForm.password} onChange={(event) => setStaffForm((current) => ({ ...current, password: event.target.value }))} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <select value={staffForm.role} onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value }))} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
            </select>
            <Input placeholder="Department" value={staffForm.department} onChange={(event) => setStaffForm((current) => ({ ...current, department: event.target.value }))} />
          </div>
          {staffForm.role === "doctor" ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Input placeholder="Specialization" value={staffForm.specialization} onChange={(event) => setStaffForm((current) => ({ ...current, specialization: event.target.value }))} />
              <Input type="number" min="0" placeholder="Experience years" value={staffForm.experienceYears} onChange={(event) => setStaffForm((current) => ({ ...current, experienceYears: event.target.value }))} />
              <Input type="number" min="0" placeholder="Fee (cents)" value={staffForm.consultationFeeCents} onChange={(event) => setStaffForm((current) => ({ ...current, consultationFeeCents: event.target.value }))} />
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create account
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function TrendBarsCard({ title, data, valueKey, formatter, emptyTitle, emptyDescription }) {
  return (
    <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
      <div className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{title}</div>
      <div className="mt-5">
        {data.length ? (
          <TrendBars data={data} valueKey={valueKey} formatter={formatter} />
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </div>
    </div>
  );
}
