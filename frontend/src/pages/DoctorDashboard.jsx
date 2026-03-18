import { CalendarDays, ClipboardCheck, Clock3, Plus, Save, Stethoscope } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDashboard } from "../services/dashboardService";
import {
  addMyTimeOff,
  getMyAvailability,
  listMyTimeOff,
  updateMyAvailability,
} from "../services/doctorService";
import { createConsultation, downloadPrescriptionPdf } from "../services/medicalRecordService";
import { updateAppointmentStatus } from "../services/appointmentService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatDateTime, statusTone } from "../utils/formatters";

const weekdayOptions = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function freshConsultation() {
  return {
    encounterType: "outpatient",
    chiefComplaint: "",
    diagnosis: "",
    clinicalNotes: "",
    doctorNotes: "",
    labSummary: "",
    followUpInDays: 30,
    vitals: { bp: "", pulse: "", spo2: "" },
    prescriptions: [
      { medicationName: "", dosage: "", frequency: "", durationDays: 5, instructions: "" },
    ],
  };
}

export default function DoctorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [timeOff, setTimeOff] = useState([]);
  const [consultationTarget, setConsultationTarget] = useState(null);
  const [consultation, setConsultation] = useState(freshConsultation());
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [savingConsultation, setSavingConsultation] = useState(false);
  const [timeOffForm, setTimeOffForm] = useState({ startsAt: "", endsAt: "", reason: "" });

  async function load() {
    try {
      const [dashboardData, availabilityData, timeOffData] = await Promise.all([
        getDashboard(),
        getMyAvailability(),
        listMyTimeOff(),
      ]);
      setDashboard(dashboardData);
      setAvailability(availabilityData);
      setTimeOff(timeOffData);
    } catch {
      toast.error("Unable to load doctor workspace");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function changeStatus(appointmentId, status) {
    try {
      await updateAppointmentStatus(appointmentId, { status });
      toast.success("Appointment updated");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update appointment");
    }
  }

  async function saveAvailability() {
    setSavingAvailability(true);
    try {
      await updateMyAvailability(availability);
      toast.success("Availability updated");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update availability");
    } finally {
      setSavingAvailability(false);
    }
  }

  async function addTimeOffEntry() {
    try {
      await addMyTimeOff({
        startsAt: new Date(timeOffForm.startsAt).toISOString(),
        endsAt: new Date(timeOffForm.endsAt).toISOString(),
        reason: timeOffForm.reason,
      });
      setTimeOffForm({ startsAt: "", endsAt: "", reason: "" });
      toast.success("Time off added");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add time off");
    }
  }

  async function submitConsultation() {
    if (!consultationTarget) return;
    setSavingConsultation(true);

    try {
      const result = await createConsultation({
        appointmentId: consultationTarget.id,
        ...consultation,
        followUpInDays: Number(consultation.followUpInDays) || 0,
        prescriptions: consultation.prescriptions.map((item) => ({
          ...item,
          durationDays: Number(item.durationDays) || 1,
        })),
      });

      toast.success("Consultation recorded");
      await downloadPrescriptionPdf(result.id);
      setConsultationTarget(null);
      setConsultation(freshConsultation());
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save consultation");
    } finally {
      setSavingConsultation(false);
    }
  }

  const stats = dashboard?.stats || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Doctor workflow"
        title="Clinical queue and consultation workspace"
        description="Manage daily appointment flow, document consultations, and maintain your availability calendar."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock3} label="Today's queue" value={stats.todayQueue || 0} helper="Scheduled patients for today" />
        <StatCard icon={CalendarDays} label="Total appointments" value={stats.totalAppointments || 0} helper="Across active history" accent="teal" />
        <StatCard icon={ClipboardCheck} label="Completed visits" value={stats.completedVisits || 0} helper="Documented and closed consultations" accent="amber" />
        <StatCard icon={Stethoscope} label="Care continuity" value={dashboard?.appointments?.length || 0} helper="Latest visits ready for review" />
      </div>

      <PaginatedTable
        rows={dashboard?.queue || []}
        emptyState={<EmptyState title="No active queue" description="Your active day queue will appear here." />}
        columns={[
          { key: "patientName", label: "Patient" },
          { key: "scheduledStart", label: "Scheduled time", render: (row) => formatDateTime(row.scheduledStart) },
          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => changeStatus(row.id, "confirmed")}>
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => changeStatus(row.id, "in_consultation")}>
                  Start
                </Button>
                <Button size="sm" variant="secondary" onClick={() => changeStatus(row.id, "completed")}>
                  Complete
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setConsultationTarget(row);
                    setConsultation(freshConsultation());
                  }}
                >
                  Open consult
                </Button>
              </div>
            ),
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Availability planner</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {availability.map((rule, index) => (
              <div key={`${rule.weekday}-${index}`} className="grid gap-3 md:grid-cols-4">
                <select
                  value={rule.weekday}
                  onChange={(event) =>
                    setAvailability((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, weekday: Number(event.target.value) } : item
                      )
                    )
                  }
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  {weekdayOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Input
                  type="time"
                  value={rule.startTime}
                  onChange={(event) =>
                    setAvailability((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, startTime: event.target.value } : item
                      )
                    )
                  }
                />
                <Input
                  type="time"
                  value={rule.endTime}
                  onChange={(event) =>
                    setAvailability((items) =>
                      items.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, endTime: event.target.value } : item
                      )
                    )
                  }
                />
                <div className="flex gap-2">
                  <select
                    value={rule.slotMinutes}
                    onChange={(event) =>
                      setAvailability((items) =>
                        items.map((item, itemIndex) =>
                          itemIndex === index
                            ? { ...item, slotMinutes: Number(event.target.value) }
                            : item
                        )
                      )
                    }
                    className="h-11 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                  >
                    {[15, 20, 30, 45, 60].map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setAvailability((items) => items.filter((_, itemIndex) => itemIndex !== index))
                    }
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                onClick={() =>
                  setAvailability((items) => [
                    ...items,
                    { weekday: 1, startTime: "09:00", endTime: "17:00", slotMinutes: 30 },
                  ])
                }
              >
                <Plus className="h-4 w-4" />
                Add rule
              </Button>
              <Button onClick={saveAvailability} loading={savingAvailability}>
                <Save className="h-4 w-4" />
                Save availability
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time off and blackout periods</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="datetime-local"
                value={timeOffForm.startsAt}
                onChange={(event) =>
                  setTimeOffForm((current) => ({ ...current, startsAt: event.target.value }))
                }
              />
              <Input
                type="datetime-local"
                value={timeOffForm.endsAt}
                onChange={(event) =>
                  setTimeOffForm((current) => ({ ...current, endsAt: event.target.value }))
                }
              />
            </div>
            <Input
              value={timeOffForm.reason}
              onChange={(event) =>
                setTimeOffForm((current) => ({ ...current, reason: event.target.value }))
              }
              placeholder="Conference, surgery block, leave"
            />
            <Button onClick={addTimeOffEntry}>Add time off</Button>

            <div className="space-y-3">
              {timeOff.length ? (
                timeOff.map((entry) => (
                  <div key={entry.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {entry.reason || "Unavailable"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {formatDateTime(entry.startsAt)} to {formatDateTime(entry.endsAt)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No time off entries"
                  description="Add leave or blackout windows to protect your booking calendar."
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Modal
        open={Boolean(consultationTarget)}
        onClose={() => setConsultationTarget(null)}
        title={`Consultation for ${consultationTarget?.patientName || "patient"}`}
      >
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              placeholder="Chief complaint"
              value={consultation.chiefComplaint}
              onChange={(event) =>
                setConsultation((current) => ({ ...current, chiefComplaint: event.target.value }))
              }
            />
            <Input
              placeholder="Diagnosis"
              value={consultation.diagnosis}
              onChange={(event) =>
                setConsultation((current) => ({ ...current, diagnosis: event.target.value }))
              }
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {["bp", "pulse", "spo2"].map((key) => (
              <Input
                key={key}
                placeholder={key.toUpperCase()}
                value={consultation.vitals[key]}
                onChange={(event) =>
                  setConsultation((current) => ({
                    ...current,
                    vitals: { ...current.vitals, [key]: event.target.value },
                  }))
                }
              />
            ))}
          </div>

          <textarea
            rows={4}
            value={consultation.clinicalNotes}
            onChange={(event) =>
              setConsultation((current) => ({ ...current, clinicalNotes: event.target.value }))
            }
            placeholder="Clinical notes"
            className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
          />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Prescription
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setConsultation((current) => ({
                    ...current,
                    prescriptions: [
                      ...current.prescriptions,
                      {
                        medicationName: "",
                        dosage: "",
                        frequency: "",
                        durationDays: 5,
                        instructions: "",
                      },
                    ],
                  }))
                }
              >
                Add medicine
              </Button>
            </div>
            {consultation.prescriptions.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-3xl border border-slate-200 p-4 dark:border-slate-800 md:grid-cols-4">
                <Input
                  placeholder="Medicine"
                  value={item.medicationName}
                  onChange={(event) =>
                    setConsultation((current) => ({
                      ...current,
                      prescriptions: current.prescriptions.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, medicationName: event.target.value }
                          : entry
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Dosage"
                  value={item.dosage}
                  onChange={(event) =>
                    setConsultation((current) => ({
                      ...current,
                      prescriptions: current.prescriptions.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, dosage: event.target.value } : entry
                      ),
                    }))
                  }
                />
                <Input
                  placeholder="Frequency"
                  value={item.frequency}
                  onChange={(event) =>
                    setConsultation((current) => ({
                      ...current,
                      prescriptions: current.prescriptions.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, frequency: event.target.value } : entry
                      ),
                    }))
                  }
                />
                <Input
                  type="number"
                  min="1"
                  placeholder="Days"
                  value={item.durationDays}
                  onChange={(event) =>
                    setConsultation((current) => ({
                      ...current,
                      prescriptions: current.prescriptions.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, durationDays: event.target.value }
                          : entry
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setConsultationTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitConsultation} loading={savingConsultation}>
              Save consultation
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
