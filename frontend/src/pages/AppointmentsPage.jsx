import { CalendarDays, MessageSquareText, RefreshCcw, Siren, Video } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getUser } from "../services/session";
import { listDoctors, getDoctorAvailability } from "../services/doctorService";
import { listPatients } from "../services/patientService";
import {
  bookAppointment,
  createWaitlist,
  listAppointments,
  listWaitlist,
  rescheduleAppointment,
  updateAppointmentStatus,
} from "../services/appointmentService";
import {
  getTelemedicineSession,
  listTelemedicineMessages,
  sendTelemedicineMessage,
} from "../services/telemedicineService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { formatDateTime, statusTone } from "../utils/formatters";

function formatDateInput(date) {
  const value = new Date(date);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

export default function AppointmentsPage() {
  const user = getUser();
  const canBook = user?.role !== "doctor";
  const canManageStatus = ["doctor", "admin", "receptionist"].includes(user?.role);
  const canSeeWaitlist = ["doctor", "admin", "receptionist"].includes(user?.role);

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [slots, setSlots] = useState([]);
  const [form, setForm] = useState({
    patientId: "",
    doctorId: "",
    date: formatDateInput(new Date()),
    startsAt: "",
    reason: "",
    appointmentType: "consultation",
    consultationMode: "in_person",
    priority: "routine",
    waitingListRequested: false,
  });
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState(formatDateInput(new Date()));
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [rescheduleSelection, setRescheduleSelection] = useState("");
  const [telemedicine, setTelemedicine] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatBody, setChatBody] = useState("");

  async function load() {
    try {
      const tasks = [listAppointments(), listDoctors()];

      if (user?.role === "admin" || user?.role === "receptionist") {
        tasks.push(listPatients());
      } else {
        tasks.push(Promise.resolve([]));
      }

      if (canSeeWaitlist) {
        tasks.push(listWaitlist());
      } else {
        tasks.push(Promise.resolve([]));
      }

      const [appointmentData, doctorData, patientData, waitlistData] = await Promise.all(tasks);
      setAppointments(appointmentData);
      setDoctors(doctorData);
      setPatients(patientData);
      setWaitlist(waitlistData);
    } catch {
      toast.error("Unable to load appointment workflows");
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!form.doctorId || !form.date) {
      setSlots([]);
      return;
    }

    getDoctorAvailability(form.doctorId, form.date)
      .then((response) => setSlots(response.slots || []))
      .catch(() => toast.error("Unable to load real-time availability"));
  }, [form.doctorId, form.date]);

  useEffect(() => {
    if (!rescheduleTarget || !rescheduleDate) return;

    getDoctorAvailability(rescheduleTarget.doctorId, rescheduleDate)
      .then((response) => setRescheduleSlots(response.slots || []))
      .catch(() => toast.error("Unable to load slots for rescheduling"));
  }, [rescheduleTarget, rescheduleDate]);

  async function submitBooking() {
    try {
      const result = await bookAppointment({
        patientId: form.patientId ? Number(form.patientId) : undefined,
        doctorId: Number(form.doctorId),
        startsAt: form.startsAt || undefined,
        reason: form.reason || undefined,
        appointmentType: form.appointmentType,
        consultationMode: form.consultationMode,
        priority: form.priority,
        waitingListRequested: form.waitingListRequested,
      });

      if (result.waitlist) {
        toast.success("No slot was free, so the patient was added to the waitlist.");
      } else {
        toast.success("Appointment booked and invoice created.");
      }

      setForm((current) => ({
        ...current,
        startsAt: "",
        reason: "",
      }));
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create booking");
    }
  }

  async function joinWaitlist() {
    if (!form.doctorId || !form.date) return;

    try {
      await createWaitlist({
        patientId: form.patientId ? Number(form.patientId) : undefined,
        doctorId: Number(form.doctorId),
        preferredDate: form.date,
        priority: form.priority,
        reason: form.reason || undefined,
      });
      toast.success("Waitlist entry created");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to join waitlist");
    }
  }

  async function changeStatus(id, status) {
    try {
      await updateAppointmentStatus(id, { status });
      toast.success("Appointment updated");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update appointment");
    }
  }

  async function submitReschedule() {
    if (!rescheduleTarget || !rescheduleSelection) return;

    try {
      await rescheduleAppointment(rescheduleTarget.id, { startsAt: rescheduleSelection });
      toast.success("Appointment rescheduled");
      setRescheduleTarget(null);
      setRescheduleSelection("");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to reschedule appointment");
    }
  }

  async function openTelemedicine(appointment) {
    try {
      const [sessionData, messageData] = await Promise.all([
        getTelemedicineSession(appointment.id),
        listTelemedicineMessages(appointment.id),
      ]);
      setTelemedicine({ appointment, session: sessionData.session });
      setMessages(messageData);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to open telemedicine workspace");
    }
  }

  async function sendMessage() {
    if (!telemedicine || !chatBody.trim()) return;

    try {
      const message = await sendTelemedicineMessage(telemedicine.appointment.id, chatBody.trim());
      setMessages((current) => [...current, message]);
      setChatBody("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to send message");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Appointment operations"
        title="Booking, queue control, and virtual consults"
        description="Run real-world appointment workflows with conflict-free slot booking, rescheduling, waitlists, and telemedicine coordination."
      />

      {canBook ? (
        <Card>
          <CardHeader>
            <CardTitle>Create appointment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {(user?.role === "admin" || user?.role === "receptionist") ? (
                <select
                  value={form.patientId}
                  onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                  className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="">Select patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.fullName} ({patient.medicalRecordNumber})
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                value={form.doctorId}
                onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.fullName} - {doctor.specialization}
                  </option>
                ))}
              </select>
              <Input type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <select
                value={form.appointmentType}
                onChange={(event) => setForm((current) => ({ ...current, appointmentType: event.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="consultation">Consultation</option>
                <option value="follow_up">Follow-up</option>
                <option value="lab_review">Lab review</option>
                <option value="vaccination">Vaccination</option>
              </select>
              <select
                value={form.consultationMode}
                onChange={(event) => setForm((current) => ({ ...current, consultationMode: event.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="in_person">In person</option>
                <option value="telemedicine">Telemedicine</option>
              </select>
              <select
                value={form.priority}
                onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="routine">Routine</option>
                <option value="urgent">Urgent</option>
                <option value="emergency">Emergency</option>
              </select>
            </div>

            <Input
              value={form.reason}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Reason for visit"
            />

            <div className="rounded-3xl border border-dashed border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                <CalendarDays className="h-4 w-4" />
                Available slots
              </div>
              {slots.length ? (
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <button
                      key={slot.startsAt}
                      onClick={() => setForm((current) => ({ ...current, startsAt: slot.startsAt }))}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        form.startsAt === slot.startsAt
                          ? "bg-gradient-to-r from-brand-600 to-tealish-600 text-white"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      }`}
                    >
                      {new Date(slot.startsAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No live slots for the selected date. You can create a waitlist request instead.
                </div>
              )}
            </div>

            <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={form.waitingListRequested}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    waitingListRequested: event.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              Add the patient to the waiting list if the selected slot is no longer available
            </label>

            <div className="flex flex-wrap gap-3">
              <Button onClick={submitBooking}>Book appointment</Button>
              <Button variant="outline" onClick={joinWaitlist}>
                <Siren className="h-4 w-4" />
                Join waitlist
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <PaginatedTable
        rows={appointments}
        emptyState={<EmptyState title="No appointments found" description="Bookings will appear here once they are created." />}
        columns={[
          { key: "patientName", label: "Patient", render: (row) => row.patientName || "Self" },
          { key: "doctorName", label: "Doctor" },
          { key: "scheduledStart", label: "Scheduled", render: (row) => formatDateTime(row.scheduledStart) },
          { key: "priority", label: "Priority", render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge> },
          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                {canManageStatus ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => changeStatus(row.id, "confirmed")}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => changeStatus(row.id, "checked_in")}>
                      Check in
                    </Button>
                  </>
                ) : null}
                {user?.role !== "doctor" ? (
                  <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(row)}>
                    <RefreshCcw className="h-4 w-4" />
                    Reschedule
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={() => changeStatus(row.id, "cancelled")}>
                  Cancel
                </Button>
                {row.consultationMode === "telemedicine" ? (
                  <Button size="sm" onClick={() => openTelemedicine(row)}>
                    <Video className="h-4 w-4" />
                    Virtual room
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
      />

      {canSeeWaitlist ? (
        <PaginatedTable
          rows={waitlist}
          emptyState={<EmptyState title="Waitlist is clear" description="No pending waitlist requests at the moment." />}
          columns={[
            { key: "patientName", label: "Patient" },
            { key: "doctorName", label: "Doctor" },
            { key: "preferredDate", label: "Preferred date" },
            { key: "priority", label: "Priority", render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge> },
            { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
          ]}
        />
      ) : null}

      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title={`Reschedule ${rescheduleTarget?.patientName || "appointment"}`}
      >
        <div className="space-y-4">
          <Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            {rescheduleSlots.map((slot) => (
              <button
                key={slot.startsAt}
                onClick={() => setRescheduleSelection(slot.startsAt)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  rescheduleSelection === slot.startsAt
                    ? "bg-gradient-to-r from-brand-600 to-tealish-600 text-white"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200"
                }`}
              >
                {new Date(slot.startsAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitReschedule}>Save new slot</Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(telemedicine)}
        onClose={() => setTelemedicine(null)}
        title={`Telemedicine room for ${telemedicine?.appointment?.patientName || "appointment"}`}
      >
        <div className="space-y-5">
          <Card>
            <CardContent className="space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Video consultation placeholder
              </div>
              <a
                href={telemedicine?.session?.joinUrl}
                target="_blank"
                rel="noreferrer"
                className="break-all text-sm font-semibold text-brand-700 dark:text-brand-300"
              >
                {telemedicine?.session?.joinUrl}
              </a>
            </CardContent>
          </Card>

          <div className="max-h-72 space-y-3 overflow-y-auto">
            {messages.length ? (
              messages.map((message) => (
                <div key={message.id} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {message.senderName || `User ${message.senderUserId}`}
                    </div>
                    <Badge tone="slate">{formatDateTime(message.createdAt)}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                    {message.body}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No messages yet"
                description="Use this placeholder chat to coordinate before or during the virtual consult."
              />
            )}
          </div>

          <div className="flex gap-3">
            <Input value={chatBody} onChange={(event) => setChatBody(event.target.value)} placeholder="Send a message to the appointment room" />
            <Button onClick={sendMessage}>
              <MessageSquareText className="h-4 w-4" />
              Send
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
