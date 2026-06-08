import { 
  CalendarDays, 
  MessageSquareText, 
  RefreshCcw, 
  Siren, 
  Video,
  List,
  Calendar,
  CalendarRange,
  Clock,
  User,
  Search,
  Filter,
  Check,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  MapPin,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Plus,
  Send,
  Sparkles,
  Phone,
  VideoOff,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Activity,
  ArrowRight
} from "lucide-react";
import { useEffect, useState, useMemo } from "react";
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
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/ui/KpiCard";
import { formatDateTime, statusTone, formatDate } from "../utils/formatters";
import { cn } from "../utils/cn";

function formatDateInput(date) {
  const value = new Date(date);
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${value.getFullYear()}-${month}-${day}`;
}

const getInitials = (name) => {
  if (!name) return "PT";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const getAvatarStyle = (name) => {
  const hash = (name || "").split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const colors = [
    "from-blue-600 to-indigo-500 shadow-blue-500/10",
    "from-teal-600 to-emerald-500 shadow-teal-500/10",
    "from-violet-600 to-purple-500 shadow-violet-500/10",
    "from-amber-600 to-orange-500 shadow-amber-500/10",
    "from-rose-600 to-pink-500 shadow-rose-500/10",
    "from-cyan-600 to-blue-500 shadow-cyan-500/10",
  ];
  return colors[hash % colors.length];
};

function AppointmentsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/80 h-32 flex flex-col justify-between">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <div className="h-10 w-10 rounded-xl bg-slate-200 dark:bg-slate-800" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Filters Skeleton */}
      <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950/80 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>

      {/* Content Area Skeleton */}
      <div className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/80 h-96">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function AppointmentTimeline({ status, cancellationReason }) {
  const steps = [
    { key: "scheduled", label: "Booked", desc: "Appointment requested" },
    { key: "confirmed", label: "Confirmed", desc: "Clinician confirmed" },
    { key: "checked_in", label: "Checked In", desc: "Patient present at clinic" },
    { key: "in_consultation", label: "Consulting", desc: "Consultation in progress" },
    { key: "completed", label: "Completed", desc: "Visit completed" }
  ];

  const statusIndexMap = {
    scheduled: 0,
    confirmed: 1,
    checked_in: 2,
    in_consultation: 3,
    completed: 4
  };

  const isCancelled = status === "cancelled";
  const isNoShow = status === "no_show";

  if (isCancelled || isNoShow) {
    return (
      <div className="relative pl-6 space-y-4 my-2 border-l border-slate-200 dark:border-slate-800 ml-4.5">
        <div className="relative pl-6">
          <div className="absolute -left-9.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Scheduled</div>
          <div className="text-xxs text-slate-400">Appointment was created</div>
        </div>
        <div className="relative pl-6">
          <div className="absolute -left-9.5 top-0 flex h-7 w-7 items-center justify-center rounded-full border border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10">
            {isCancelled ? (
              <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            ) : (
              <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
            )}
          </div>
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {isCancelled ? "Cancelled" : "No Show"}
          </div>
          {isCancelled && cancellationReason && (
            <div className="mt-1 text-xxs italic text-slate-500 dark:text-slate-400">
              Reason: "{cancellationReason}"
            </div>
          )}
        </div>
      </div>
    );
  }

  const currentIdx = statusIndexMap[status] ?? 0;

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 md:gap-2 my-2 py-4">
      {steps.map((step, idx) => {
        const isPast = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isFuture = idx > currentIdx;

        return (
          <div key={step.key} className="flex-1 w-full md:w-auto flex flex-row md:flex-col items-center gap-3 md:gap-2 relative">
            {idx < steps.length - 1 && (
              <div className={cn(
                "hidden md:block absolute top-4 left-[50%] right-[-50%] h-0.5 z-0 transition-colors duration-300",
                isPast ? "bg-brand-500" : "bg-slate-100 dark:bg-slate-800"
              )} />
            )}

            <div className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center border font-bold text-xs z-10 transition-all duration-300 shrink-0",
              isPast && "bg-brand-500 border-transparent text-white shadow-premium-glow",
              isCurrent && "bg-white border-brand-500 text-brand-600 ring-4 ring-brand-500/10 dark:bg-slate-950 dark:text-brand-300",
              isFuture && "bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-600"
            )}>
              {isPast ? <Check className="h-4 w-4" /> : idx + 1}
            </div>

            <div className="text-left md:text-center flex-1 md:flex-initial">
              <div className={cn(
                "text-xs font-bold leading-tight",
                isCurrent ? "text-brand-600 dark:text-brand-300" : "text-slate-800 dark:text-slate-200"
              )}>
                {step.label}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 leading-normal hidden md:block">
                {step.desc}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const [loading, setLoading] = useState(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterMode, setFilterMode] = useState("all");
  const [viewMode, setViewMode] = useState("table"); // table, calendar, agenda

  // Calendar View States
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(new Date());

  // Row Expansion State
  const [expandedRowId, setExpandedRowId] = useState(null);

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
    setLoading(true);
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
    } finally {
      setLoading(false);
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

  // Statistics KPI computation
  const stats = useMemo(() => {
    const total = appointments.length;
    const pendingConfirm = appointments.filter((a) => a.status === "scheduled").length;
    const active = appointments.filter((a) => ["checked_in", "in_consultation"].includes(a.status)).length;
    const telemed = appointments.filter((a) => a.consultationMode === "telemedicine" && a.status !== "cancelled").length;
    const waitlisted = waitlist.length;

    return { total, pendingConfirm, active, telemed, waitlisted };
  }, [appointments, waitlist]);

  // Client-side Filtered list for Table and Agenda Views
  const filteredAppointments = useMemo(() => {
    return appointments.filter((appt) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        (appt.patientName || "Self").toLowerCase().includes(searchQuery.toLowerCase()) ||
        appt.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (appt.reason || "").toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = filterPriority === "all" || appt.priority === filterPriority;
      const matchesStatus = filterStatus === "all" || appt.status === filterStatus;
      const matchesMode = filterMode === "all" || appt.consultationMode === filterMode;

      return matchesSearch && matchesPriority && matchesStatus && matchesMode;
    });
  }, [appointments, searchQuery, filterPriority, filterStatus, filterMode]);

  // Grouped for Agenda View
  const agendaGroups = useMemo(() => {
    const groups = {};
    const sorted = [...filteredAppointments].sort((a, b) => new Date(a.scheduledStart) - new Date(b.scheduledStart));
    
    sorted.forEach((appt) => {
      const dateStr = new Date(appt.scheduledStart).toLocaleDateString([], {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(appt);
    });
    return Object.entries(groups);
  }, [filteredAppointments]);

  // Calendar cells generation helper
  const calendarDays = useMemo(() => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const totalDaysPrev = new Date(year, month, 0).getDate();

    const cells = [];
    
    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        date: new Date(year, month - 1, totalDaysPrev - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      cells.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      cells.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return cells;
  }, [calendarDate]);

  function getAppointmentsForDate(date) {
    const targetStr = date.toISOString().slice(0, 10);
    return appointments.filter((appt) => {
      const apptStr = new Date(appt.scheduledStart).toISOString().slice(0, 10);
      return apptStr === targetStr;
    });
  }

  // Pre-formatted Select Options
  const patientOptions = useMemo(() => [
    { value: "", label: "Select patient" },
    ...patients.map((p) => ({
      value: String(p.id),
      label: `${p.fullName} (${p.medicalRecordNumber})`,
    })),
  ], [patients]);

  const doctorOptions = useMemo(() => [
    { value: "", label: "Select doctor" },
    ...doctors.map((d) => ({
      value: String(d.id),
      label: `${d.fullName} - ${d.specialization}`,
    })),
  ], [doctors]);

  const priorityOptions = [
    { value: "routine", label: "Routine Priority" },
    { value: "urgent", label: "Urgent Priority" },
    { value: "emergency", label: "Emergency Priority" },
  ];

  const modeOptions = [
    { value: "in_person", label: "In Person Consultation" },
    { value: "telemedicine", label: "Telemedicine Room" },
  ];

  const typeOptions = [
    { value: "consultation", label: "Consultation visit" },
    { value: "follow_up", label: "Follow-up visit" },
    { value: "lab_review", label: "Lab review visit" },
    { value: "vaccination", label: "Vaccination visit" },
  ];

  if (loading) {
    return <AppointmentsSkeleton />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Appointment operations"
        title="Booking, queue control, and virtual consults"
        description="Run real-world appointment workflows with conflict-free slot booking, rescheduling, waitlists, and telemedicine coordination."
      />

      {/* KPI Stats Pane */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={CalendarDays}
          label="Total Bookings"
          value={stats.total}
          accent="brand"
          description="Appointments scheduled"
        />
        <KpiCard
          icon={Activity}
          label="Active Consults"
          value={stats.active}
          accent="teal"
          description="In clinic checked-in"
        />
        <KpiCard
          icon={Video}
          label="Virtual Rooms"
          value={stats.telemed}
          accent="success"
          description="Telemedicine coordinate channels"
        />
        <KpiCard
          icon={Siren}
          label="Waitlisted Patients"
          value={stats.waitlisted}
          accent="rose"
          description="Pending slot releases"
        />
      </div>

      {/* Booking Composer Form */}
      {canBook ? (
        <Card className="rounded-[28px] overflow-hidden border border-slate-200/60 dark:border-neutral-200/10 shadow-premium relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-600 to-tealish-600" />
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-500" />
              <span>Create appointment</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 lg:grid-cols-3">
              {(user?.role === "admin" || user?.role === "receptionist") ? (
                <div className="flex flex-col gap-1.5">
                  <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Patient</span>
                  <Select
                    value={form.patientId}
                    onChange={(event) => setForm((current) => ({ ...current, patientId: event.target.value }))}
                    options={patientOptions}
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Clinician</span>
                <Select
                  value={form.doctorId}
                  onChange={(event) => setForm((current) => ({ ...current, doctorId: event.target.value }))}
                  options={doctorOptions}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Preferred Date</span>
                <Input 
                  type="date" 
                  value={form.date} 
                  onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} 
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Appointment Type</span>
                <Select
                  value={form.appointmentType}
                  onChange={(event) => setForm((current) => ({ ...current, appointmentType: event.target.value }))}
                  options={typeOptions}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Consultation Mode</span>
                <Select
                  value={form.consultationMode}
                  onChange={(event) => setForm((current) => ({ ...current, consultationMode: event.target.value }))}
                  options={modeOptions}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Priority Level</span>
                <Select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}
                  options={priorityOptions}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Reason for visit</span>
              <Input
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder="e.g., Routine general review, post-op assessment, chest congestion"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Availability Slots picker */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-900/10">
              <div className="mb-4.5 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-250">
                <CalendarDays className="h-4.5 w-4.5 text-brand-500" />
                <span>Available time slots</span>
              </div>
              {slots.length ? (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                  {slots.map((slot) => {
                    const isSelected = form.startsAt === slot.startsAt;
                    return (
                      <button
                        key={slot.startsAt}
                        type="button"
                        onClick={() => setForm((current) => ({ ...current, startsAt: slot.startsAt }))}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-2xl py-2 px-3 border transition-all duration-200 group text-center",
                          isSelected
                            ? "bg-gradient-to-r from-brand-600 to-tealish-600 border-transparent text-white shadow-premium-glow scale-[1.03]"
                            : "bg-slate-50 border-slate-150 hover:border-slate-350 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/60 dark:border-slate-800/40 dark:hover:border-slate-850 dark:text-slate-300"
                        )}
                      >
                        <Clock className={cn("h-3.5 w-3.5 mb-1 text-slate-400 group-hover:text-slate-600 dark:text-slate-500", isSelected && "text-white/80")} />
                        <span className="text-xs font-bold">
                          {new Date(slot.startsAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-2xl bg-amber-500/5 border border-amber-500/10 p-4 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 text-amber-500" />
                  <span>No live slots for the selected date. You can request a waitlist position instead.</span>
                </div>
              )}
            </div>

            {/* Waitlist Toggle */}
            <label className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 select-none cursor-pointer">
              <input
                type="checkbox"
                checked={form.waitingListRequested}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    waitingListRequested: event.target.checked,
                  }))
                }
                className="h-4.5 w-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
              />
              <span className="font-medium text-slate-700 dark:text-slate-300">Add to waiting list automatically if requested slot is unavailable</span>
            </label>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button onClick={submitBooking} className="bg-brand-600 hover:bg-brand-700 rounded-xl px-5 h-11 text-white shadow-premium-glow">
                Book Appointment
              </Button>
              <Button variant="outline" onClick={joinWaitlist} className="rounded-xl px-5 h-11 border-slate-200 hover:bg-slate-50 dark:border-neutral-200/10 dark:hover:bg-neutral-100/5 flex items-center gap-2">
                <Siren className="h-4.5 w-4.5 text-rose-500" />
                Join Waitlist
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Advanced Filters & Search Strip */}
      <Card className="rounded-[24px] overflow-hidden border border-slate-200/60 dark:border-neutral-200/10 shadow-premium">
        <div className="p-4 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-950/20">
          
          {/* Left: View Mode Selectors */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl dark:bg-neutral-200/5 max-w-max w-full md:w-auto">
            <button
              onClick={() => setViewMode("table")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 flex-1 md:flex-initial",
                viewMode === "table"
                  ? "bg-white text-brand-750 shadow-sm dark:bg-neutral-100 dark:text-white"
                  : "text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-neutral-100/5"
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 flex-1 md:flex-initial",
                viewMode === "calendar"
                  ? "bg-white text-brand-750 shadow-sm dark:bg-neutral-100 dark:text-white"
                  : "text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-neutral-100/5"
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>Calendar</span>
            </button>
            <button
              onClick={() => setViewMode("agenda")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all duration-200 flex-1 md:flex-initial",
                viewMode === "agenda"
                  ? "bg-white text-brand-750 shadow-sm dark:bg-neutral-100 dark:text-white"
                  : "text-slate-500 hover:bg-white/40 dark:text-slate-400 dark:hover:bg-neutral-100/5"
              )}
            >
              <CalendarRange className="h-3.5 w-3.5" />
              <span>Agenda</span>
            </button>
          </div>

          {/* Right: Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 w-full md:w-auto flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search patient, doctor, reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 pl-9 text-xs"
              />
            </div>
            
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white/60 px-3 text-xs focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none dark:border-neutral-200/10 dark:bg-neutral-100/40 dark:text-slate-100"
            >
              <option value="all">All Priorities</option>
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="emergency">Emergency</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white/60 px-3 text-xs focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none dark:border-neutral-200/10 dark:bg-neutral-100/40 dark:text-slate-100"
            >
              <option value="all">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="confirmed">Confirmed</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>

            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white/60 px-3 text-xs focus:ring-4 focus:ring-brand-500/10 focus-visible:outline-none dark:border-neutral-200/10 dark:bg-neutral-100/40 dark:text-slate-100"
            >
              <option value="all">All Modes</option>
              <option value="in_person">In Person</option>
              <option value="telemedicine">Telemedicine</option>
            </select>
          </div>
        </div>

        {/* Dynamic View Content */}
        <CardContent className="p-0 border-t border-slate-100 dark:border-neutral-200/5">
          
          {/* Empty state checker */}
          {filteredAppointments.length === 0 && viewMode !== "calendar" && (
            <div className="p-10">
              <EmptyState 
                title="No appointments found" 
                description="Adjust your filters or query term to find records, or book a new slot above." 
              />
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === "table" && filteredAppointments.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-250/60 text-slate-400 dark:border-neutral-200/10 bg-slate-50/40 dark:bg-neutral-100/25">
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Patient</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Doctor</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Scheduled Time</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Consultation Mode</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Priority</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="px-5 py-4 font-bold text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/60 dark:divide-neutral-200/10">
                  {filteredAppointments.map((row) => {
                    const isExpanded = expandedRowId === row.id;
                    const pInitials = getInitials(row.patientName || "Self");
                    const pAvatarBg = getAvatarStyle(row.patientName || "Self");
                    const dInitials = getInitials(row.doctorName);
                    const dAvatarBg = getAvatarStyle(row.doctorName);

                    return (
                      <tbody key={row.id} className="divide-none border-b border-slate-100 dark:border-neutral-200/10">
                        <tr 
                          onClick={() => toggleRow(row.id)}
                          className={cn(
                            "cursor-pointer hover:bg-slate-50/50 dark:hover:bg-neutral-100/10 transition-colors duration-150",
                            isExpanded && "bg-slate-50/70 dark:bg-neutral-100/5"
                          )}
                        >
                          {/* Patient Avatars & details */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr font-bold text-xs text-white shadow-sm", pAvatarBg)}>
                                {pInitials}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">{row.patientName || "Self"}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{row.medicalRecordNumber || "N/A"}</div>
                              </div>
                            </div>
                          </td>

                          {/* Doctor Avatars & details */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className={cn("relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr font-bold text-xs text-white shadow-sm", dAvatarBg)}>
                                {dInitials}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white">Dr. {row.doctorName}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{row.specialization}</div>
                              </div>
                            </div>
                          </td>

                          {/* Scheduled Date/Time block */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              <div>
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {new Date(row.scheduledStart).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                                <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                                  {new Date(row.scheduledStart).toLocaleDateString([], {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Mode info */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              {row.consultationMode === "telemedicine" ? (
                                <Badge tone="teal" className="flex items-center gap-1.5 px-2.5 py-1">
                                  <Video className="h-3 w-3" />
                                  <span>Telemedicine</span>
                                </Badge>
                              ) : (
                                <Badge tone="brand" className="flex items-center gap-1.5 px-2.5 py-1">
                                  <MapPin className="h-3 w-3" />
                                  <span>In Person</span>
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Priority badges */}
                          <td className="px-5 py-4">
                            <Badge tone={statusTone(row.priority)} className="capitalize px-2.5 py-1">
                              {row.priority}
                            </Badge>
                          </td>

                          {/* Status badges */}
                          <td className="px-5 py-4">
                            <Badge tone={statusTone(row.status)} className="capitalize px-2.5 py-1">
                              {row.status?.replaceAll("_", " ")}
                            </Badge>
                          </td>

                          {/* Quick action buttons */}
                          <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {canManageStatus && row.status === "scheduled" && (
                                <Button size="xs" onClick={() => changeStatus(row.id, "confirmed")} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg">
                                  Confirm
                                </Button>
                              )}
                              {canManageStatus && row.status === "confirmed" && (
                                <Button size="xs" onClick={() => changeStatus(row.id, "checked_in")} className="bg-tealish-600 hover:bg-tealish-750 text-white rounded-lg">
                                  Check In
                                </Button>
                              )}
                              {canManageStatus && row.status === "checked_in" && (
                                <Button size="xs" onClick={() => changeStatus(row.id, "in_consultation")} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg">
                                  Start Visit
                                </Button>
                              )}
                              {canManageStatus && row.status === "in_consultation" && (
                                <Button size="xs" onClick={() => changeStatus(row.id, "completed")} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg">
                                  Complete
                                </Button>
                              )}
                              {row.consultationMode === "telemedicine" && row.status !== "completed" && row.status !== "cancelled" && (
                                <Button size="xs" onClick={() => openTelemedicine(row)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1">
                                  <Video className="h-3 w-3" />
                                  <span>Room</span>
                                </Button>
                              )}
                              {user?.role !== "doctor" && !["completed", "cancelled", "no_show"].includes(row.status) && (
                                <Button size="xs" variant="outline" onClick={() => setRescheduleTarget(row)} className="border-slate-200 hover:bg-slate-100 text-slate-700 rounded-lg">
                                  <RefreshCcw className="h-3 w-3" />
                                </Button>
                              )}
                              {!["completed", "cancelled", "no_show"].includes(row.status) && (
                                <Button size="xs" variant="ghost" onClick={() => changeStatus(row.id, "cancelled")} className="text-rose-500 hover:bg-rose-500/10 rounded-lg">
                                  Cancel
                                </Button>
                              )}
                              <div className="text-slate-400 p-1.5 hover:bg-slate-150 dark:hover:bg-slate-800 rounded-lg transition-colors">
                                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Collapsible Row Expansion Accordion */}
                        {isExpanded && (
                          <tr className="bg-slate-50/30 dark:bg-neutral-100/5">
                            <td colSpan={7} className="px-6 py-5 border-t border-slate-150/40 dark:border-neutral-200/5">
                              <div className="grid gap-6 md:grid-cols-3">
                                {/* Left Detail Column */}
                                <div className="space-y-3.5">
                                  <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Visit Reason</span>
                                    <p className="mt-1 text-sm font-semibold text-slate-855 dark:text-slate-350 leading-relaxed">
                                      {row.reason || "No diagnosis reason specified."}
                                    </p>
                                  </div>
                                  <div className="flex gap-4">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Visit Type</span>
                                      <div className="mt-1 flex items-center gap-1.5">
                                        <Badge tone="slate" className="capitalize text-xxs px-2 py-0.5">
                                          {row.appointmentType?.replace("_", " ")}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Queue Position</span>
                                      <div className="mt-1 text-xs font-bold text-brand-600 dark:text-brand-400">
                                        #{row.queueNumber || 1} in queue
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Stepper Timeline Column */}
                                <div className="md:col-span-2 rounded-2xl border border-slate-200/50 bg-white/40 p-4 dark:border-slate-800/40 dark:bg-slate-950/20">
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Appointment Progression</span>
                                  <AppointmentTimeline status={row.status} cancellationReason={row.cancellationReason} />
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* CALENDAR VIEW */}
          {viewMode === "calendar" && (
            <div className="p-6 grid gap-6 lg:grid-cols-3">
              
              {/* Calendar Grid Container */}
              <div className="lg:col-span-2 border border-slate-200/80 rounded-[24px] p-5 bg-white dark:border-slate-800/80 dark:bg-slate-950/60 shadow-sm space-y-4">
                
                {/* Header Month selectors */}
                <div className="flex items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      {calendarDate.toLocaleString([], { month: "long", year: "numeric" })}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 bg-slate-100/60 p-1 rounded-xl dark:bg-slate-900/60">
                    <button
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}
                      className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-350 transition-all"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setCalendarDate(new Date())}
                      className="px-2.5 py-1 text-[10px] font-bold hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-200 transition-all"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}
                      className="p-1.5 hover:bg-white dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-350 transition-all"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Days of Week Header */}
                <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-neutral-500 py-1.5 border-b border-slate-100 dark:border-slate-800">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Day cells grid */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarDays.map((cell, idx) => {
                    const appts = getAppointmentsForDate(cell.date);
                    const isToday = cell.date.toDateString() === new Date().toDateString();
                    const isSelected = cell.date.toDateString() === selectedCalendarDate.toDateString();

                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCalendarDate(cell.date)}
                        className={cn(
                          "min-h-[72px] p-2 flex flex-col justify-between items-start rounded-xl border text-left transition-all duration-200 group relative",
                          cell.isCurrentMonth
                            ? "bg-slate-50/30 border-slate-100 hover:border-slate-250 text-slate-800 dark:bg-slate-900/10 dark:border-slate-850 dark:hover:border-slate-700 dark:text-slate-200"
                            : "bg-white border-transparent text-slate-450 opacity-40 hover:opacity-75 dark:bg-transparent dark:text-slate-600",
                          isToday && "bg-brand-50/50 border-brand-200 text-brand-700 dark:bg-brand-500/10 dark:border-brand-500/20 dark:text-brand-300",
                          isSelected && "ring-2 ring-brand-600 dark:ring-brand-500 border-transparent shadow-sm"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-bold leading-none h-5 w-5 rounded-lg flex items-center justify-center",
                          isToday && "bg-brand-600 text-white font-extrabold"
                        )}>
                          {cell.date.getDate()}
                        </span>

                        {/* List indicators/dots for day appointments */}
                        {appts.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5 w-full">
                            {appts.slice(0, 3).map((appt) => {
                              const dotColor = appt.priority === "emergency" 
                                ? "bg-rose-500 shadow-rose-500/20" 
                                : appt.priority === "urgent" 
                                  ? "bg-amber-500 shadow-amber-500/20" 
                                  : "bg-teal-500 shadow-teal-500/20";
                              return (
                                <span 
                                  key={appt.id} 
                                  className={cn("h-1.5 w-1.5 rounded-full shrink-0", dotColor)}
                                  title={`${appt.patientName || "Self"} - Dr. ${appt.doctorName}`} 
                                />
                              );
                            })}
                            {appts.length > 3 && (
                              <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 leading-none">
                                +{appts.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calendar details panel */}
              <div className="border border-slate-250/50 rounded-[24px] p-5 bg-slate-50/50 dark:border-slate-800/80 dark:bg-slate-900/20 space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-neutral-500">Day Assessment</span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    {selectedCalendarDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                  </h4>
                </div>

                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {getAppointmentsForDate(selectedCalendarDate).length > 0 ? (
                    getAppointmentsForDate(selectedCalendarDate).map((appt) => {
                      const initials = getInitials(appt.patientName || "Self");
                      const avatarBg = getAvatarStyle(appt.patientName || "Self");
                      return (
                        <div 
                          key={appt.id}
                          className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80 hover:shadow-md transition-shadow relative overflow-hidden group"
                        >
                          <div className={cn("absolute top-0 bottom-0 left-0 w-1", appt.priority === "emergency" ? "bg-rose-500" : appt.priority === "urgent" ? "bg-amber-500" : "bg-teal-500")} />
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr font-extrabold text-[10px] text-white", avatarBg)}>
                                {initials}
                              </div>
                              <div>
                                <h5 className="text-xs font-bold text-slate-900 dark:text-white">{appt.patientName || "Self"}</h5>
                                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">Dr. {appt.doctorName}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-350 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                              {new Date(appt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          
                          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 dark:border-slate-850">
                            <Badge tone={statusTone(appt.status)} className="text-[9px] px-2 py-0.5">
                              {appt.status?.replace("_", " ")}
                            </Badge>
                            
                            <div className="flex gap-1">
                              {appt.consultationMode === "telemedicine" && appt.status !== "completed" && appt.status !== "cancelled" && (
                                <button
                                  onClick={() => openTelemedicine(appt)}
                                  className="p-1 rounded-md text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/20"
                                >
                                  <Video className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {canManageStatus && appt.status === "scheduled" && (
                                <button
                                  onClick={() => changeStatus(appt.id, "confirmed")}
                                  className="p-1 rounded-md text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/20"
                                  title="Confirm Appointment"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState 
                      title="No bookings" 
                      description="No appointments scheduled for this date cell." 
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AGENDA VIEW */}
          {viewMode === "agenda" && filteredAppointments.length > 0 && (
            <div className="p-6 max-w-4xl mx-auto space-y-8 relative">
              <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-slate-200/80 dark:bg-neutral-200/5 hidden sm:block" />
              {agendaGroups.map(([dateStr, appts]) => (
                <div key={dateStr} className="space-y-4">
                  {/* Sticky Date Title Section */}
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="h-5 w-5 rounded-full border-4 border-white bg-brand-600 ring-1 ring-brand-500/30 dark:border-slate-950 hidden sm:block ml-2.5 shrink-0" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 dark:bg-brand-950/30 px-3 py-1 rounded-xl">
                      {dateStr}
                    </h3>
                  </div>

                  {/* List of cards */}
                  <div className="space-y-3.5 pl-0 sm:pl-10">
                    {appts.map((appt) => {
                      const pInitials = getInitials(appt.patientName || "Self");
                      const pAvatar = getAvatarStyle(appt.patientName || "Self");
                      const dInitials = getInitials(appt.doctorName);
                      const dAvatar = getAvatarStyle(appt.doctorName);

                      return (
                        <div 
                          key={appt.id}
                          className="rounded-[22px] border border-slate-200 bg-white p-5 shadow-sm dark:border-neutral-200/10 dark:bg-neutral-100/20 hover:shadow-md transition-shadow relative overflow-hidden group"
                        >
                          <div className={cn("absolute top-0 bottom-0 left-0 w-1.5", appt.priority === "emergency" ? "bg-rose-500" : appt.priority === "urgent" ? "bg-amber-500" : "bg-teal-500")} />
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            
                            <div className="flex flex-wrap items-center gap-5">
                              {/* Time block badge */}
                              <div className="flex items-center gap-1.5 text-sm font-black text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-900/60 p-2 rounded-xl border border-slate-100 dark:border-slate-800">
                                <Clock className="h-4 w-4 text-slate-400" />
                                <span>
                                  {new Date(appt.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              {/* Patient */}
                              <div className="flex items-center gap-2.5">
                                <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr font-bold text-[10px] text-white", pAvatar)}>
                                  {pInitials}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">{appt.patientName || "Self"}</div>
                                  <div className="text-[9px] text-slate-400 font-semibold">{appt.medicalRecordNumber || "MRN N/A"}</div>
                                </div>
                              </div>

                              <ArrowRight className="h-4 w-4 text-slate-300 hidden md:block" />

                              {/* Doctor */}
                              <div className="flex items-center gap-2.5">
                                <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr font-bold text-[10px] text-white", dAvatar)}>
                                  {dInitials}
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-900 dark:text-white">Dr. {appt.doctorName}</div>
                                  <div className="text-[9px] text-slate-400 font-semibold">{appt.specialization}</div>
                                </div>
                              </div>
                            </div>

                            {/* Middle details & action rows */}
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge tone={statusTone(appt.priority)} className="text-[10px]">
                                {appt.priority}
                              </Badge>
                              <Badge tone={statusTone(appt.status)} className="text-[10px]">
                                {appt.status?.replace("_", " ")}
                              </Badge>
                              {appt.consultationMode === "telemedicine" ? (
                                <Badge tone="teal" className="text-[10px] flex items-center gap-1">
                                  <Video className="h-2.5 w-2.5" />
                                  <span>Telemedicine</span>
                                </Badge>
                              ) : (
                                <Badge tone="brand" className="text-[10px] flex items-center gap-1">
                                  <MapPin className="h-2.5 w-2.5" />
                                  <span>In Person</span>
                                </Badge>
                              )}
                            </div>

                            {/* Row actions */}
                            <div className="flex items-center justify-end gap-1 border-t border-slate-100/60 pt-3 md:border-none md:pt-0">
                              {canManageStatus && appt.status === "scheduled" && (
                                <Button size="sm" onClick={() => changeStatus(appt.id, "confirmed")} className="bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs h-9">
                                  Confirm
                                </Button>
                              )}
                              {canManageStatus && appt.status === "confirmed" && (
                                <Button size="sm" onClick={() => changeStatus(appt.id, "checked_in")} className="bg-tealish-600 hover:bg-tealish-750 text-white rounded-lg text-xs h-9">
                                  Check In
                                </Button>
                              )}
                              {canManageStatus && appt.status === "checked_in" && (
                                <Button size="sm" onClick={() => changeStatus(appt.id, "in_consultation")} className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-9">
                                  Start Visit
                                </Button>
                              )}
                              {rowActions(appt)}
                            </div>

                          </div>

                          {appt.reason && (
                            <div className="mt-3.5 border-t border-dashed border-slate-100 pt-3 dark:border-neutral-205/10">
                              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Reason</span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{appt.reason}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

        </CardContent>
      </Card>

      {/* Waitlist Section */}
      {canSeeWaitlist ? (
        <Card className="rounded-[28px] overflow-hidden border border-slate-200/60 dark:border-neutral-200/10 shadow-premium relative">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-rose-500 to-amber-500" />
          <CardHeader>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Siren className="h-5 w-5 text-rose-500" />
              <span>Waitlisted queue</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 border-t border-slate-150/40 dark:border-neutral-200/5">
            <PaginatedTable
              rows={waitlist}
              pageSize={5}
              emptyState={<EmptyState title="Waitlist is clear" description="No pending waitlist requests at the moment." />}
              columns={[
                { 
                  key: "patientName", 
                  label: "Patient",
                  render: (row) => {
                    const initials = getInitials(row.patientName);
                    const avatarBg = getAvatarStyle(row.patientName);
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className={cn("relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-tr font-bold text-[10px] text-white", avatarBg)}>
                          {initials}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">{row.patientName}</span>
                      </div>
                    );
                  }
                },
                { 
                  key: "doctorName", 
                  label: "Requested Doctor",
                  render: (row) => (
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      Dr. {row.doctorName}
                    </div>
                  )
                },
                { 
                  key: "preferredDate", 
                  label: "Preferred Date",
                  render: (row) => (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-450 font-semibold">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>{formatDate(row.preferredDate)}</span>
                      {row.preferredWindow && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[9px] font-bold">at {row.preferredWindow}</span>}
                    </div>
                  )
                },
                { key: "priority", label: "Priority", render: (row) => <Badge tone={statusTone(row.priority)}>{row.priority}</Badge> },
                { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
              ]}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Rescheduling Modal */}
      <Modal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        title={`Reschedule ${rescheduleTarget?.patientName || "appointment"}`}
      >
        <div className="space-y-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Select Date</span>
            <Input type="date" value={rescheduleDate} onChange={(event) => setRescheduleDate(event.target.value)} className="h-11 rounded-xl" />
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/10">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-250 block mb-3.5">Available Slots</span>
            {rescheduleSlots.length ? (
              <div className="grid grid-cols-3 gap-2">
                {rescheduleSlots.map((slot) => {
                  const isSelected = rescheduleSelection === slot.startsAt;
                  return (
                    <button
                      key={slot.startsAt}
                      type="button"
                      onClick={() => setRescheduleSelection(slot.startsAt)}
                      className={cn(
                        "rounded-xl py-2 px-3 border text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center text-center",
                        isSelected
                          ? "bg-gradient-to-r from-brand-600 to-tealish-600 border-transparent text-white shadow-premium-glow"
                          : "bg-slate-100/60 border-slate-150 hover:bg-slate-100 text-slate-700 dark:bg-slate-900/60 dark:border-slate-800 dark:text-slate-355"
                      )}
                    >
                      <Clock className="h-3.5 w-3.5 mb-1 opacity-70" />
                      <span>
                        {new Date(slot.startsAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 dark:text-slate-500 py-2">
                No slots are currently releaseable for this date.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setRescheduleTarget(null)} className="rounded-xl h-11 px-5 border border-slate-200 hover:bg-slate-50 dark:border-neutral-200/10 dark:hover:bg-neutral-100/5">
              Cancel
            </Button>
            <Button onClick={submitReschedule} className="bg-brand-600 hover:bg-brand-700 rounded-xl h-11 px-5 text-white shadow-premium-glow">
              Save New Slot
            </Button>
          </div>
        </div>
      </Modal>

      {/* Telemedicine Coordinator Room Modal */}
      <Modal
        open={Boolean(telemedicine)}
        onClose={() => setTelemedicine(null)}
        title={`Telemedicine workspace for ${telemedicine?.appointment?.patientName || "appointment"}`}
        className="max-w-4xl"
      >
        <div className="grid gap-5 lg:grid-cols-2">
          
          {/* Mock Video Workspace panel */}
          <div className="space-y-4">
            <div className="relative aspect-video rounded-3xl bg-slate-950 flex flex-col items-center justify-center overflow-hidden border border-slate-800 shadow-premium">
              <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-10 text-center p-4">
                <div className="h-12 w-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center animate-pulse">
                  <Video className="h-6 w-6 text-brand-400" />
                </div>
                <div className="text-sm font-bold text-slate-200">Patient virtual room active</div>
                <div className="text-xs text-slate-500 max-w-xs leading-relaxed">
                  WebRTC coordinate signals are established. The medical consultation is ready.
                </div>
              </div>
            </div>
            
            <Card className="rounded-[22px] border-slate-150/60 dark:border-neutral-200/10">
              <CardContent className="p-4 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                  Secure Video Stream URL
                </div>
                <div className="break-all rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs text-slate-700 dark:text-slate-300 font-semibold border border-slate-100 dark:border-slate-800 select-all">
                  {telemedicine?.session?.joinUrl}
                </div>
                <div className="pt-1">
                  <a
                    href={telemedicine?.session?.joinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-premium-glow hover:bg-brand-700 hover:scale-[1.02] active:scale-100 transition-all duration-200"
                  >
                    <Video className="h-4 w-4" />
                    <span>Launch Consultation Screen</span>
                  </a>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Coordination Chat Room panel */}
          <Card className="rounded-3xl border-slate-150/60 dark:border-neutral-200/10 flex flex-col h-[400px]">
            <CardHeader className="py-4.5 border-b border-slate-100 dark:border-neutral-200/10 bg-slate-50/50 dark:bg-slate-900/10">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <MessageSquareText className="h-4.5 w-4.5 text-brand-500" />
                <span>Pre-Consultation Coordination</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 overflow-y-auto space-y-4 max-h-[260px]">
              {messages.length ? (
                messages.map((message) => {
                  const isCurrentUser = Number(message.senderUserId) === Number(user?.id);
                  return (
                    <div key={message.id} className={cn("flex flex-col max-w-[85%]", isCurrentUser ? "ml-auto items-end" : "mr-auto items-start")}>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 px-1.5 font-bold">
                        {!isCurrentUser && (message.senderName || "Patient")} • {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className={cn(
                        "rounded-2xl px-4 py-2.5 text-xs font-semibold shadow-sm leading-relaxed",
                        isCurrentUser
                          ? "bg-brand-600 text-white rounded-tr-none"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-250 rounded-tl-none border border-slate-200/50 dark:border-slate-850"
                      )}>
                        {message.body}
                      </div>
                    </div>
                  );
                })
              ) : (
                <EmptyState
                  title="No messages yet"
                  description="Use this private chat panel to coordinate with the patient during the consult."
                />
              )}
            </CardContent>
            
            <div className="p-3 border-t border-slate-100 dark:border-neutral-200/10 flex gap-2">
              <Input 
                value={chatBody} 
                onChange={(event) => setChatBody(event.target.value)} 
                placeholder="Send coordinates or notes..." 
                className="h-10 text-xs"
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
              />
              <Button onClick={sendMessage} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl h-10 px-4 flex items-center gap-1 shadow-premium-glow text-xs shrink-0">
                <Send className="h-3.5 w-3.5" />
                <span>Send</span>
              </Button>
            </div>
          </Card>

        </div>
      </Modal>
    </div>
  );

  // Helper row actions renderer for agenda view
  function rowActions(appt) {
    return (
      <div className="flex gap-1">
        {appt.consultationMode === "telemedicine" && appt.status !== "completed" && appt.status !== "cancelled" && (
          <Button size="sm" onClick={() => openTelemedicine(appt)} className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-1.5 text-xs h-9">
            <Video className="h-3.5 w-3.5" />
            <span>Virtual Room</span>
          </Button>
        )}
        {user?.role !== "doctor" && !["completed", "cancelled", "no_show"].includes(appt.status) && (
          <Button size="sm" variant="outline" onClick={() => setRescheduleTarget(appt)} className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs h-9 flex items-center gap-1">
            <RefreshCcw className="h-3.5 w-3.5" />
            <span>Reschedule</span>
          </Button>
        )}
        {!["completed", "cancelled", "no_show"].includes(appt.status) && (
          <Button size="sm" variant="ghost" onClick={() => changeStatus(appt.id, "cancelled")} className="text-rose-500 hover:bg-rose-500/10 rounded-lg text-xs h-9">
            Cancel
          </Button>
        )}
      </div>
    );
  }
}
