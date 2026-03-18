import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { listMyAppointments, updateAppointmentStatus } from "../services/appointmentService";
import WeekCalendar from "../components/calendar/WeekCalendar";
import DoctorAvailability from "../components/doctor/DoctorAvailability";
import ReportsPanel from "../components/reports/ReportsPanel";
import AppointmentsTable from "../components/appointments/AppointmentsTable";

export default function DoctorDashboard() {
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);

  async function load() {
    setLoading(true);
    try {
      const rows = await listMyAppointments();
      setAppointments(rows);
    } catch {
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return appointments.filter((a) => {
      const t = new Date(a.starts_at).getTime();
      return t >= start.getTime() && t < end.getTime() && a.status !== "cancelled";
    });
  }, [appointments]);

  async function setStatus(id, status) {
    try {
      await updateAppointmentStatus(id, status);
      toast.success("Updated");
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Update failed");
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Calendar</CardTitle>
          <CardDescription>Your schedule for the week</CardDescription>
        </CardHeader>
        <CardContent>
          <WeekCalendar events={appointments.filter((a) => a.status !== "cancelled")} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Today’s appointments</CardTitle>
          <CardDescription>Confirm or complete visits as they happen.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
              <div className="h-10 w-full animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900" />
            </div>
          ) : today.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 dark:text-slate-400">
                    <th className="py-2">Patient</th>
                    <th className="py-2">Time</th>
                    <th className="py-2">Status</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {today.map((a) => (
                    <tr key={a.id} className="border-t border-slate-200/70 dark:border-slate-800/60">
                      <td className="py-3 font-semibold">{a.patient_name}</td>
                      <td className="py-3">{new Date(a.starts_at).toLocaleTimeString()}</td>
                      <td className="py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatus(a.id, "confirmed")}
                            disabled={a.status === "confirmed" || a.status === "completed"}
                          >
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setStatus(a.id, "completed")}
                            disabled={a.status === "completed" || a.status === "cancelled"}
                          >
                            Complete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
              No appointments today.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Appointments</CardTitle>
          <CardDescription>Attach reports per visit</CardDescription>
        </CardHeader>
        <CardContent>
          <AppointmentsTable appointments={appointments} canCancel={false} mode="doctor" />
        </CardContent>
      </Card>

      <DoctorAvailability />

      <ReportsPanel />
    </div>
  );
}

