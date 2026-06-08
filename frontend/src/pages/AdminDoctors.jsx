import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit2,
  Eye,
  User,
  Mail,
  Phone,
  Stethoscope,
  Clock,
  Shield,
  Briefcase,
  ToggleLeft,
  ToggleRight,
  Activity,
  Award,
  Landmark,
  CheckCircle,
  XCircle,
  Building2,
  ChevronLeft
} from "lucide-react";
import {
  listDoctors,
  createDoctor,
  updateDoctor,
  updateDoctorAvailability,
  getDoctorById,
} from "../services/doctorService";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Select } from "../components/ui/Select";
import { Skeleton } from "../components/ui/Skeleton";
import { KpiCard } from "../components/ui/KpiCard";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const initialForm = {
  employee_id: "",
  fullName: "",
  email: "",
  phone: "",
  specialization: "",
  qualification: "",
  years_experience: 0,
  consultation_fee: 0,
  availability_status: "AVAILABLE",
  biography: "",
  password: "",
  department: "General",
  license_number: "",
};

const getInitials = (name) => {
  if (!name) return "DR";
  return name
    .trim()
    .split(/\s+/)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

function DoctorsListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-wrap gap-4">
        <Skeleton className="h-11 w-72" />
      </div>
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
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

function DoctorProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="rounded-[28px] border border-white/70 bg-white p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 h-80 flex flex-col items-center justify-center gap-4">
          <Skeleton className="h-24 w-24 rounded-full" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/85 h-80">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Profile view states
  const [viewingDoctorId, setViewingDoctorId] = useState(null);
  const [doctorDetails, setDoctorDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await listDoctors({ search: searchQuery });
      setDoctors(Array.isArray(data) ? data : (data.rows || []));
    } catch {
      toast.error("Unable to load doctors list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [searchQuery]);

  async function loadDetails(id) {
    setLoadingDetails(true);
    try {
      const details = await getDoctorById(id);
      setDoctorDetails(details);
    } catch {
      toast.error("Unable to load doctor details");
    } finally {
      setLoadingDetails(false);
    }
  }

  useEffect(() => {
    if (viewingDoctorId) {
      loadDetails(viewingDoctorId);
    }
  }, [viewingDoctorId]);

  const handleOpenAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (doc) => {
    setForm({
      employee_id: doc.employee_id || doc.employeeCode || "",
      fullName: doc.fullName || doc.full_name || "",
      email: doc.email || "",
      phone: doc.phone || "",
      specialization: doc.specialization || "",
      qualification: doc.qualification || "",
      years_experience: doc.years_experience || doc.experienceYears || 0,
      consultation_fee: doc.consultation_fee || (doc.consultation_fee_cents ? doc.consultation_fee_cents / 100 : 0),
      availability_status: doc.availability_status || "AVAILABLE",
      biography: doc.biography || "",
      password: "",
      department: doc.department || "General",
      license_number: doc.licenseNumber || doc.license_number || "",
    });
    setEditingId(doc.id);
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.employee_id ||
      !form.fullName ||
      !form.email ||
      !form.specialization ||
      !form.qualification
    ) {
      toast.error("Employee ID, Full Name, Email, Specialization, and Qualification are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoctor(editingId, form);
        toast.success("Doctor profile updated successfully");
      } else {
        await createDoctor({
          ...form,
          password: form.password || "Password@123",
        });
        toast.success("Doctor registered successfully");
      }
      setOpen(false);
      if (viewingDoctorId === editingId) {
        loadDetails(viewingDoctorId);
      }
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save doctor");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailability = async (doc) => {
    const nextStatus = doc.availability_status === "AVAILABLE" ? "UNAVAILABLE" : "AVAILABLE";
    try {
      await updateDoctorAvailability(doc.id, nextStatus);
      toast.success(`Doctor availability set to ${nextStatus}`);
      await load();
      if (viewingDoctorId === doc.id) {
        loadDetails(viewingDoctorId);
      }
    } catch (error) {
      toast.error("Failed to update availability");
    }
  };

  // Compute metrics from local list
  const totalDoctors = doctors.length;
  const activeCount = doctors.filter((d) => d.availability_status === "AVAILABLE").length;
  const avgExperience = doctors.length
    ? Math.round(doctors.reduce((sum, d) => sum + (d.years_experience || d.experienceYears || 0), 0) / doctors.length)
    : 0;
  const avgFee = doctors.length
    ? Math.round(doctors.reduce((sum, d) => sum + (d.consultation_fee_cents || d.consultation_fee * 100 || 0), 0) / doctors.length / 100)
    : 0;

  return (
    <div className="space-y-6">
      {viewingDoctorId ? (
        // Doctor Details view
        loadingDetails || !doctorDetails ? (
          <DoctorProfileSkeleton />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <button
                onClick={() => {
                  setViewingDoctorId(null);
                  setDoctorDetails(null);
                }}
                className="group flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-300 dark:hover:bg-neutral-100/20 transition-all duration-200"
              >
                <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
                <span>Back to doctor directory</span>
              </button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => handleOpenEdit(doctorDetails)}>
                  <Edit2 className="h-4 w-4" />
                  Edit Profile
                </Button>
                <Button
                  variant={doctorDetails?.availability_status === "AVAILABLE" ? "outline" : "default"}
                  onClick={() => handleToggleAvailability(doctorDetails)}
                  className={`flex items-center gap-2 rounded-xl border ${
                    doctorDetails?.availability_status === "AVAILABLE"
                      ? "border-red-200 bg-red-50/10 text-red-650 hover:bg-red-50/30 dark:border-red-950/20 dark:text-red-400"
                      : "bg-teal-600 hover:bg-teal-700 text-white"
                  }`}
                >
                  {doctorDetails?.availability_status === "AVAILABLE" ? (
                    <>
                      <XCircle className="h-4 w-4" />
                      Set Unavailable
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Set Available
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-[1fr_2.2fr]">
              {/* Profile card summary */}
              <div className="relative overflow-hidden rounded-[24px] border border-slate-200/60 bg-white shadow-premium dark:border-neutral-200/10 dark:bg-neutral-100/20 p-6 text-center space-y-5">
                <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-600 to-tealish-600" />
                
                <div className="relative mx-auto flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-tr from-brand-600 to-tealish-500 font-black text-3xl text-white shadow-premium-glow">
                  {getInitials(doctorDetails.fullName)}
                </div>
                
                <div>
                  <h2 className="text-2xl font-black text-slate-950 dark:text-white tracking-tight">
                    {doctorDetails.fullName}
                  </h2>
                  <p className="text-sm font-bold text-brand-600 dark:text-brand-400 mt-1">
                    {doctorDetails.specialization}
                  </p>
                </div>
                
                <div className="flex justify-center">
                  <Badge tone={doctorDetails.availability_status === "AVAILABLE" ? "teal" : "red"}>
                    {doctorDetails.availability_status}
                  </Badge>
                </div>
                
                <div className="border-t border-slate-100/80 pt-4 dark:border-neutral-200/5 space-y-3.5 text-left text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Employee ID</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {doctorDetails.employee_id}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Department</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {doctorDetails.department || "General"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Experience</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">
                      {doctorDetails.years_experience} Years
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-400">Consultation Fee</span>
                    <span className="font-bold text-slate-850 dark:text-slate-150">
                      {formatCurrency(doctorDetails.consultation_fee_cents || doctorDetails.consultation_fee * 100)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Professional details */}
              <div className="space-y-6">
                <Card className="rounded-[24px]">
                  <CardHeader>
                    <CardTitle>Professional Credentials & Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 hover:bg-slate-50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          <Mail className="h-4 w-4 text-brand-500" /> Email Address
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-all">
                          {doctorDetails.email}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 hover:bg-slate-50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          <Phone className="h-4 w-4 text-brand-500" /> Phone Number
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {doctorDetails.phone || "Not provided"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 hover:bg-slate-50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          <Shield className="h-4 w-4 text-tealish-500" /> License Number
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {doctorDetails.licenseNumber || doctorDetails.license_number || "N/A"}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 hover:bg-slate-50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          <Briefcase className="h-4 w-4 text-tealish-500" /> Qualification
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {doctorDetails.qualification}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100/80 pt-4 dark:border-neutral-200/5">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-2">
                        Biography
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                        {doctorDetails.biography || "No biography details documented."}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Week Schedule Card */}
                <Card className="rounded-[24px]">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-brand-600" /> Weekly Availability Schedule
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-5">
                      {[1, 2, 3, 4, 5].map((dayIndex) => {
                        const dayName = WEEKDAYS[dayIndex];
                        const isAvailable = doctorDetails.availability_status === "AVAILABLE";
                        return (
                          <div
                            key={dayIndex}
                            className={`rounded-2xl border p-4 transition-all duration-350 hover:scale-[1.02] ${
                              isAvailable
                                ? "border-teal-100 bg-teal-50/20 dark:border-teal-950/20 dark:bg-teal-950/5"
                                : "border-slate-100 bg-slate-50/50 dark:border-slate-800/20 dark:bg-slate-900/10"
                            }`}
                          >
                            <div className="text-xs font-bold text-slate-750 dark:text-slate-250">
                              {dayName}
                            </div>
                            <div className="mt-3.5 space-y-2">
                              {isAvailable ? (
                                <>
                                  <div className="text-[10px] font-bold text-center text-tealish-700 dark:text-tealish-450 bg-tealish-50 dark:bg-tealish-950/30 px-1.5 py-0.5 rounded-lg">
                                    09:00 - 13:00
                                  </div>
                                  <div className="text-[10px] font-bold text-center text-tealish-700 dark:text-tealish-450 bg-tealish-50 dark:bg-tealish-950/30 px-1.5 py-0.5 rounded-lg">
                                    14:00 - 17:00
                                  </div>
                                </>
                              ) : (
                                <div className="text-[9px] font-semibold tracking-wide text-slate-400 dark:text-slate-500 text-center py-2.5 uppercase">
                                  Time off
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )
      ) : (
        // Doctor List view
        <>
          <PageHeader
            eyebrow="Hospital operations"
            title="Doctor Directory"
            description="Manage clinical staff, provision doctor credentials, edit profiles, and set availability."
            actions={
              <Button onClick={handleOpenAdd} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-button-glow">
                <Plus className="h-4 w-4" />
                Add Doctor
              </Button>
            }
          />

          {/* KPI Dashboard */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total Doctors"
              value={totalDoctors}
              icon={User}
              accent="brand"
            />
            <KpiCard
              label="Active Clinicians"
              value={activeCount}
              icon={Activity}
              accent="teal"
            />
            <KpiCard
              label="Average Experience"
              value={`${avgExperience} Yrs`}
              icon={Award}
              accent="success"
            />
            <KpiCard
              label="Average Fee"
              value={formatCurrency(avgFee * 100)}
              icon={Landmark}
              accent="amber"
            />
          </div>

          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search doctors by name, code, department..."
              className="pl-11"
            />
          </div>

          {loading ? (
            <DoctorsListSkeleton />
          ) : (
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
              <PaginatedTable
                rows={doctors}
                pageSize={10}
                columns={[
                  {
                    key: "fullName",
                    label: "Doctor Name",
                    render: (row) => {
                      const name = row.fullName || row.full_name;
                      return (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-xs text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                            {getInitials(name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {name}
                            </div>
                            <div className="text-[10px] font-semibold text-slate-400 tracking-wide uppercase">{row.employee_id || row.employeeCode || row.employee_code}</div>
                          </div>
                        </div>
                      );
                    },
                  },
                  { key: "specialization", label: "Specialization" },
                  { key: "qualification", label: "Qualification" },
                  {
                    key: "years_experience",
                    label: "Experience",
                    render: (row) => `${row.years_experience || row.experienceYears || 0} Yrs`,
                  },
                  {
                    key: "consultation_fee",
                    label: "Fee",
                    render: (row) => formatCurrency(row.consultation_fee_cents || row.consultation_fee * 100),
                  },
                  {
                    key: "availability_status",
                    label: "Availability",
                    render: (row) => (
                      <Badge tone={row.availability_status === "AVAILABLE" ? "teal" : "slate"}>
                        {row.availability_status}
                      </Badge>
                    ),
                  },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingDoctorId(row.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-400 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-all duration-205"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(row)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-400 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-all duration-205"
                          title="Edit profile"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleAvailability(row)}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/55 hover:scale-105 transition-all duration-200 ${
                            row.availability_status === "AVAILABLE"
                              ? "border-red-105 hover:bg-red-50 text-red-500 hover:text-red-650 dark:border-red-950/20 dark:hover:bg-red-950/30"
                              : "border-teal-105 hover:bg-teal-50 text-teal-500 hover:text-teal-650 dark:border-teal-950/20 dark:hover:bg-teal-950/30"
                          }`}
                          title="Toggle Availability"
                        >
                          {row.availability_status === "AVAILABLE" ? (
                            <ToggleRight className="h-4.5 w-4.5" />
                          ) : (
                            <ToggleLeft className="h-4.5 w-4.5 text-slate-400" />
                          )}
                        </button>
                      </div>
                    ),
                  },
                ]}
                emptyState={
                  <EmptyState
                    title="No doctors found"
                    description="No records match the current query."
                  />
                }
              />
            </div>
          )}
        </>
      )}

      {/* Form Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit Doctor Profile" : "Register New Doctor"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Employee ID *
              </span>
              <Input
                value={form.employee_id}
                onChange={(e) =>
                  setForm((current) => ({ ...current, employee_id: e.target.value }))
                }
                placeholder="e.g. DOC-101"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">
                Full Name *
              </span>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                placeholder="e.g. Dr. Jane Doe"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Email Address *
              </span>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="email@hospital.com"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Phone Number
              </span>
              <Input
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="e.g. +91 9876543210"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Specialization *
              </span>
              <Input
                value={form.specialization}
                onChange={(e) =>
                  setForm((current) => ({ ...current, specialization: e.target.value }))
                }
                placeholder="e.g. Cardiology"
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">
                Qualification *
              </span>
              <Input
                value={form.qualification}
                onChange={(e) =>
                  setForm((current) => ({ ...current, qualification: e.target.value }))
                }
                placeholder="e.g. MBBS, MD"
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Years of Experience
              </span>
              <Input
                type="number"
                value={form.years_experience}
                onChange={(e) =>
                  setForm((current) => ({ ...current, years_experience: Number(e.target.value) }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Consultation Fee ($)
              </span>
              <Input
                type="number"
                value={form.consultation_fee}
                onChange={(e) =>
                  setForm((current) => ({ ...current, consultation_fee: Number(e.target.value) }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Department
              </span>
              <Input
                value={form.department}
                onChange={(e) => setForm((current) => ({ ...current, department: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">
                License Number
              </span>
              <Input
                value={form.license_number}
                onChange={(e) =>
                  setForm((current) => ({ ...current, license_number: e.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Availability Status
              </span>
              <Select
                value={form.availability_status}
                onChange={(e) =>
                  setForm((current) => ({ ...current, availability_status: e.target.value }))
                }
                className="mt-1 bg-white"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </Select>
            </label>
          </div>
          {!editingId && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">
                Password (defaults to Password@123)
              </span>
              <Input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((current) => ({ ...current, password: e.target.value }))
                }
                placeholder="Enter login password"
              />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">
              Biography
            </span>
            <textarea
              value={form.biography}
              onChange={(e) => setForm((current) => ({ ...current, biography: e.target.value }))}
              rows={3}
              className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-850 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/70"
              placeholder="Enter biographical notes..."
            />
          </label>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              {editingId ? "Update Doctor" : "Register Doctor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
