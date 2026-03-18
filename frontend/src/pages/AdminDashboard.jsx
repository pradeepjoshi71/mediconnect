import { BarChart3, Plus, Users, CalendarDays, Stethoscope } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { createDoctor, listAllAppointments, listUsers } from "../services/adminService";
import { listPayments } from "../services/paymentService";

function StatCard({ icon: Icon, label, value }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200">
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </CardTitle>
        <CardDescription>System overview</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    specialization: "",
    experienceYears: 5,
    rating: 4.7,
  });

  async function load() {
    setLoading(true);
    try {
      const [u, a, p] = await Promise.all([listUsers(), listAllAppointments(), listPayments()]);
      setUsers(u);
      setAppointments(a);
      setPayments(p);
    } catch {
      toast.error("Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const patients = users.filter((u) => u.role === "patient").length;
    const doctors = users.filter((u) => u.role === "doctor").length;
    return { patients, doctors };
  }, [users]);

  const revenue = useMemo(() => {
    const paid = payments.filter((p) => p.status === "paid");
    const cents = paid.reduce((sum, p) => sum + Number(p.amount_cents || 0), 0);
    return { paidCount: paid.length, cents };
  }, [payments]);

  async function onCreateDoctor(e) {
    e.preventDefault();
    setCreating(true);
    try {
      await createDoctor({
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        specialization: form.specialization,
        experienceYears: Number(form.experienceYears) || 0,
        rating: Number(form.rating) || 4.5,
      });
      toast.success("Doctor added");
      setOpen(false);
      setForm({
        fullName: "",
        email: "",
        password: "",
        specialization: "",
        experienceYears: 5,
        rating: 4.7,
      });
      load();
    } catch (e2) {
      toast.error(e2.response?.data?.message || "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Admin</div>
          <div className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Manage doctors, patients and analytics.
          </div>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Add doctor
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Patients" value={counts.patients} />
        <StatCard icon={Stethoscope} label="Doctors" value={counts.doctors} />
        <StatCard icon={CalendarDays} label="Appointments" value={appointments.length} />
        <StatCard
          icon={BarChart3}
          label="Payments (demo)"
          value={`${revenue.paidCount} paid`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent appointments</CardTitle>
          <CardDescription>Latest activity across the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
          ) : appointments.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="py-2">Patient</th>
                    <th className="py-2">Doctor</th>
                    <th className="py-2">Starts</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.slice(0, 8).map((a) => (
                    <tr key={a.id} className="border-t border-slate-200/70 dark:border-slate-800/60">
                      <td className="py-3 font-semibold">{a.patient_name}</td>
                      <td className="py-3">{a.doctor_name}</td>
                      <td className="py-3">{new Date(a.starts_at).toLocaleString()}</td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              No appointments yet.
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add doctor">
        <form onSubmit={onCreateDoctor} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              required
            />
          </div>
          <Input
            type="password"
            placeholder="Temporary password"
            value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
            required
          />
          <Input
            placeholder="Specialization (e.g., Cardiologist)"
            value={form.specialization}
            onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
            required
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              min="0"
              max="80"
              placeholder="Experience years"
              value={form.experienceYears}
              onChange={(e) => setForm((p) => ({ ...p, experienceYears: e.target.value }))}
            />
            <Input
              type="number"
              min="0"
              max="5"
              step="0.1"
              placeholder="Rating"
              value={form.rating}
              onChange={(e) => setForm((p) => ({ ...p, rating: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={creating}>
              Create
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

