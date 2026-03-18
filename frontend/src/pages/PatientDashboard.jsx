import { CalendarDays, Stethoscope, Users2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { addDays, format, startOfWeek } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { listMyAppointments } from "../services/appointmentService";
import { listDoctors } from "../services/doctorService";
import { getDoctorSlots } from "../services/availabilityService";
import { cn } from "../utils/cn";
import InteractiveWeekCalendar from "../components/calendar/InteractiveWeekCalendar";
import ReportsPanel from "../components/reports/ReportsPanel";
import { Modal } from "../components/ui/Modal";
import { Button } from "../components/ui/Button";
import { rescheduleAppointment } from "../services/appointmentService";
import AppointmentsTable from "../components/appointments/AppointmentsTable";

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span
            className={cn(
              "grid h-9 w-9 place-items-center rounded-2xl",
              accent === "blue" && "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200",
              accent === "teal" && "bg-tealish-50 text-tealish-700 dark:bg-tealish-500/15 dark:text-tealish-200",
              accent === "slate" && "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          {label}
        </CardTitle>
        <CardDescription>Last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function PatientDashboard() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [resched, setResched] = useState(null);
  const [reschedLoading, setReschedLoading] = useState(false);
  const [allowedSlots, setAllowedSlots] = useState(null);
  const [allowedDoctorId, setAllowedDoctorId] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const [a, d] = await Promise.all([listMyAppointments(), listDoctors()]);
        if (!mounted) return;
        setAppointments(a);
        setDoctors(d);
      } catch (e) {
        toast.error("Failed to load dashboard");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  async function reloadAppointments() {
    const a = await listMyAppointments();
    setAppointments(a);
  }

  async function loadAllowedSlotsForDoctor(doctorId) {
    try {
      setAllowedDoctorId(doctorId);
      const base = startOfWeek(new Date(), { weekStartsOn: 1 });
      const dates = Array.from({ length: 7 }, (_, i) => format(addDays(base, i), "yyyy-MM-dd"));
      const results = await Promise.all(dates.map((d) => getDoctorSlots(doctorId, d)));
      const set = new Set(results.flat());
      setAllowedSlots(set);
    } catch {
      setAllowedSlots(null);
    }
  }

  const upcoming = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => new Date(a.starts_at).getTime() >= now && a.status !== "cancelled")
      .slice(0, 5);
  }, [appointments]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Stat icon={CalendarDays} label="Upcoming appointments" value={upcoming.length} accent="blue" />
        <Stat icon={Users2} label="Total visits" value={appointments.length} accent="slate" />
        <Stat icon={Stethoscope} label="Doctors available" value={doctors.length} accent="teal" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Your week at a glance</CardDescription>
        </CardHeader>
        <CardContent>
          <InteractiveWeekCalendar
            events={appointments.filter((a) => a.status !== "cancelled")}
            canDrag
            allowedSlotStarts={allowedSlots || undefined}
            onDragStart={(ev) => {
              if (allowedDoctorId !== ev.doctor_id) loadAllowedSlotsForDoctor(ev.doctor_id);
            }}
            onInvalidDrop={() => toast.error("That time isn’t available for this doctor")}
            onRescheduleRequest={(payload) => setResched(payload)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming appointments</CardTitle>
          <CardDescription>Your next scheduled visits</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            </div>
          ) : upcoming.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="py-2">Doctor</th>
                    <th className="py-2">Starts</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcoming.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200/70 dark:border-slate-800/60">
                      <td className="py-3 font-semibold">{a.doctor_name}</td>
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
              No upcoming appointments yet. Use “Book appointment” to schedule your first visit.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
          <CardDescription>Attach reports and manage bookings</CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentsTable appointments={appointments} />
        </CardContent>
      </Card>

      <ReportsPanel />

      <Modal
        open={Boolean(resched)}
        onClose={() => setResched(null)}
        title="Confirm reschedule"
      >
        {resched ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-slate-500 dark:text-slate-400">New start</div>
                <div className="font-semibold">
                  {new Date(resched.startsAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-slate-500 dark:text-slate-400">New end</div>
                <div className="font-semibold">
                  {new Date(resched.endsAt).toLocaleString()}
                </div>
              </div>
              <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                This will request the new slot and notify the doctor.
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setResched(null)}>
                Cancel
              </Button>
              <Button
                loading={reschedLoading}
                onClick={async () => {
                  setReschedLoading(true);
                  try {
                    await rescheduleAppointment(resched.appointmentId, {
                      startsAt: resched.startsAt,
                      endsAt: resched.endsAt,
                    });
                    toast.success("Rescheduled");
                    setResched(null);
                    await reloadAppointments();
                  } catch (e) {
                    toast.error(e.response?.data?.message || "Reschedule failed");
                  } finally {
                    setReschedLoading(false);
                  }
                }}
              >
                Confirm
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

