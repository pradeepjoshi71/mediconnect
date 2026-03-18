import { Paperclip, CalendarClock, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { cancelAppointment } from "../../services/appointmentService";
import { listReportsForAppointment, uploadReport, reportDownloadUrl } from "../../services/reportService";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

export default function AppointmentsTable({ appointments = [], canCancel = true, mode = "patient" }) {
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [active, setActive] = useState(null);
  const [reports, setReports] = useState([]);

  const rows = useMemo(() => appointments.slice(0, 20), [appointments]);

  async function openAttach(appt) {
    setActive(appt);
    setOpen(true);
    try {
      const rows = await listReportsForAppointment(appt.id);
      setReports(rows);
    } catch {
      setReports([]);
    }
  }

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    setUploading(true);
    try {
      await uploadReport({
        file,
        appointmentId: active.id,
        doctorId: active.doctor_id,
        patientId: active.patient_id,
      });
      toast.success("Attached");
      const rows = await listReportsForAppointment(active.id);
      setReports(rows);
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 dark:text-slate-400">
            <th className="py-2">When</th>
            <th className="py-2">{mode === "doctor" ? "Patient" : "Doctor"}</th>
            <th className="py-2">Status</th>
            <th className="py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-t border-slate-200/70 dark:border-slate-800/60">
              <td className="py-3 font-semibold">
                {new Date(a.starts_at).toLocaleString()}
              </td>
              <td className="py-3">{mode === "doctor" ? a.patient_name : a.doctor_name}</td>
              <td className="py-3">
                <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {a.status}
                </span>
              </td>
              <td className="py-3">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => openAttach(a)}>
                    <Paperclip className="h-4 w-4" />
                    Reports
                  </Button>
                  {canCancel ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          await cancelAppointment(a.id);
                          toast.success("Cancelled");
                        } catch (e) {
                          toast.error(e.response?.data?.message || "Cancel failed");
                        }
                      }}
                      disabled={a.status === "cancelled" || a.status === "completed"}
                    >
                      <XCircle className="h-4 w-4" />
                      Cancel
                    </Button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={active ? `Reports for appointment #${active.id}` : "Reports"}
      >
        {active ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800">
              <div className="flex items-center gap-2 font-semibold">
                <CalendarClock className="h-4 w-4" />
                {new Date(active.starts_at).toLocaleString()}
              </div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Upload PDFs/images or lab text files (10MB max).
              </div>
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900/50">
              <Paperclip className="h-4 w-4" />
              {uploading ? "Uploading…" : "Attach report"}
              <input type="file" className="hidden" onChange={onPick} disabled={uploading} />
            </label>

            {reports.length ? (
              <div className="space-y-2">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="truncate font-semibold">{r.original_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(r.created_at).toLocaleString()}
                      </div>
                    </div>
                    <a
                      href={reportDownloadUrl(r.id)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900/50"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-400">
                No reports attached yet.
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

