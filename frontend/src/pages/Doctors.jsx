import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  Stethoscope,
  Activity,
  Award,
  Landmark,
  User,
  Shield,
  Briefcase,
  Mail,
  Phone
} from "lucide-react";
import {
  listDoctors,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
} from "../services/doctorService";
import { getUser } from "../services/session";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Select } from "../components/ui/Select";
import { KpiCard } from "../components/ui/KpiCard";
import { Skeleton } from "../components/ui/Skeleton";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const initialForm = {
  employee_id: "",
  fullName: "",
  email: "",
  phone: "",
  specialization: "",
  qualification: "",
  years_experience: 5,
  consultation_fee: 50.0,
  department: "General Medicine",
  biography: "",
  status: "active",
  password: "",
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

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  const currentUser = getUser();
  const isAdmin = ["super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  async function load() {
    setLoading(true);
    try {
      const data = await listDoctors({ search: searchQuery });
      setDoctors(data);
    } catch {
      toast.error("Unable to load doctors list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [searchQuery]);

  const handleOpenAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (doctor) => {
    setForm({
      employee_id: doctor.employee_id || doctor.employee_code || "",
      fullName: doctor.full_name || doctor.fullName || "",
      email: doctor.email || "",
      phone: doctor.phone || "",
      specialization: doctor.specialization || "",
      qualification: doctor.qualification || "",
      years_experience: doctor.years_experience || doctor.experience_years || 0,
      consultation_fee: doctor.consultation_fee || (doctor.consultation_fee_cents / 100) || 0.0,
      department: doctor.department || "General Medicine",
      biography: doctor.biography || "",
      status: doctor.status || "active",
      password: "",
    });
    setEditingId(doctor.id);
    setOpen(true);
  };

  const handleToggleStatus = async (doctor) => {
    const nextStatus = doctor.status === "active" ? "inactive" : "active";
    try {
      await updateDoctorStatus(doctor.id, nextStatus);
      toast.success(`Doctor status set to ${nextStatus}`);
      await load();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullName || !form.email || !form.specialization || !form.qualification) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updateDoctor(editingId, form);
        toast.success("Doctor details updated");
      } else {
        await createDoctor(form);
        toast.success("Doctor provisioned successfully");
      }
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save doctor");
    } finally {
      setSubmitting(false);
    }
  };

  // Compute metrics from list
  const totalDoctors = doctors.length;
  const activeCount = doctors.filter((d) => d.status === "active").length;
  const avgExperience = doctors.length
    ? Math.round(doctors.reduce((sum, d) => sum + (d.years_experience || d.experience_years || 0), 0) / doctors.length)
    : 0;
  const avgFee = doctors.length
    ? Math.round(doctors.reduce((sum, d) => sum + (d.consultation_fee_cents || d.consultation_fee * 100 || 0), 0) / doctors.length / 100)
    : 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clinical directory"
        title="Clinician management"
        description="View qualifications, experience, and specialization profiles, or provision and manage doctor accounts."
        actions={
          isAdmin && (
            <Button onClick={handleOpenAdd} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-button-glow">
              <Plus className="h-4 w-4" />
              Add doctor
            </Button>
          )
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total Clinicians"
          value={totalDoctors}
          icon={Stethoscope}
          accent="brand"
        />
        <KpiCard
          label="Active Doctors"
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
          className="pl-11 pr-4"
          placeholder="Search by name, specialization, or ID"
        />
      </div>

      {loading ? (
        <DoctorsListSkeleton />
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={doctors}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No doctors found"
                description="Try modifying your search or add a new doctor."
              />
            }
            columns={[
              {
                key: "employee_id",
                label: "Employee ID",
                render: (row) => <span className="font-semibold text-slate-900 dark:text-slate-200">{row.employee_id || row.employee_code || row.employeeCode}</span>
              },
              {
                key: "full_name",
                label: "Full Name",
                render: (row) => {
                  const name = row.full_name || row.fullName;
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-xs text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                        {getInitials(name)}
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{name}</div>
                    </div>
                  );
                }
              },
              { key: "specialization", label: "Specialization" },
              { key: "qualification", label: "Qualification" },
              {
                key: "years_experience",
                label: "Experience",
                render: (row) => `${row.years_experience || row.experienceYears || 0} Yrs`
              },
              {
                key: "consultation_fee",
                label: "Consultation Fee",
                render: (row) => formatCurrency(row.consultation_fee_cents || (row.consultation_fee * 100)),
              },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "active" ? "teal" : "slate"}>
                    {row.status}
                  </Badge>
                ),
              },
              {
                key: "created_at",
                label: "Created At",
                render: (row) => formatDateTime(row.created_at),
              },
              ...(isAdmin
                ? [
                    {
                      key: "actions",
                      label: "Actions",
                      render: (row) => (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-400 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-all duration-205"
                            title="Edit Doctor"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(row)}
                            className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/55 hover:scale-105 transition-all duration-200 ${
                              row.status === "active"
                                ? "border-red-105 hover:bg-red-50 text-red-500 hover:text-red-650 dark:border-red-950/20 dark:hover:bg-red-950/30"
                                : "border-teal-105 hover:bg-teal-50 text-teal-500 hover:text-teal-650 dark:border-teal-950/20 dark:hover:bg-teal-950/30"
                            }`}
                            title={row.status === "active" ? "Deactivate Doctor" : "Activate Doctor"}
                          >
                            {row.status === "active" ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        </div>
      )}

      {/* Add / Edit Doctor Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit Doctor Profile" : "Provision Doctor Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-450">Employee ID *</span>
              <Input
                placeholder="DOC-001"
                value={form.employee_id}
                onChange={(e) => setForm((c) => ({ ...c, employee_id: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">Full Name *</span>
              <Input
                placeholder="Dr. Asha Menon"
                value={form.fullName}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Email *</span>
              <Input
                type="email"
                placeholder="doctor@hospital.com"
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Phone</span>
              <Input
                placeholder="+91 90000 00000"
                value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Specialization *</span>
              <Input
                placeholder="Cardiology"
                value={form.specialization}
                onChange={(e) => setForm((c) => ({ ...c, specialization: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">Qualification *</span>
              <Input
                placeholder="MD, DM (Cardiology)"
                value={form.qualification}
                onChange={(e) => setForm((c) => ({ ...c, qualification: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Years Experience *</span>
              <Input
                type="number"
                min="0"
                value={form.years_experience}
                onChange={(e) => setForm((c) => ({ ...c, years_experience: Number(e.target.value) }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Consultation Fee ($) *</span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.consultation_fee}
                onChange={(e) => setForm((c) => ({ ...c, consultation_fee: Number(e.target.value) }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Department</span>
              <Input
                placeholder="General Medicine"
                value={form.department}
                onChange={(e) => setForm((c) => ({ ...c, department: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Status</span>
              <Select
                value={form.status}
                onChange={(e) => setForm((c) => ({ ...c, status: e.target.value }))}
                className="mt-1 bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
            {!editingId && (
              <label className="block">
                <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">Temporary Password</span>
                <Input
                  type="password"
                  placeholder="Optional (Default: Password@123)"
                  value={form.password}
                  onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
                />
              </label>
            )}
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">Biography</span>
            <textarea
              value={form.biography}
              onChange={(e) => setForm((c) => ({ ...c, biography: e.target.value }))}
              rows={3}
              placeholder="Brief biography or notes about the clinician"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500/70"
            />
          </label>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-200/5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              {editingId ? "Save Changes" : "Provision Doctor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
