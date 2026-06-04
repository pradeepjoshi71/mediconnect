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
      consultation_fee: doc.consultation_fee || 0,
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
          password: form.password || "Password@123", // Default if blank
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

  return (
    <div className="space-y-6">
      {viewingDoctorId ? (
        // Doctor Details view
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setViewingDoctorId(null);
                setDoctorDetails(null);
              }}
              className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
            >
              &larr; Back to directory
            </button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => handleOpenEdit(doctorDetails)}>
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </Button>
              <Button
                variant="outline"
                onClick={() => handleToggleAvailability(doctorDetails)}
              >
                {doctorDetails?.availability_status === "AVAILABLE" ? (
                  <>
                    <ToggleRight className="h-4 w-4 text-brand-600" />
                    Set Unavailable
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-4 w-4 text-slate-400" />
                    Set Available
                  </>
                )}
              </Button>
            </div>
          </div>

          {loadingDetails || !doctorDetails ? (
            <div className="flex h-[300px] items-center justify-center">
              <div className="text-sm font-semibold text-slate-500">Loading doctor profile...</div>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
              <Card>
                <CardContent className="pt-6 text-center space-y-4">
                  <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                    <User className="h-12 w-12" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-950 dark:text-white">
                      {doctorDetails.fullName}
                    </h2>
                    <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                      {doctorDetails.specialization}
                    </p>
                  </div>
                  <div className="flex justify-center">
                    <Badge tone={doctorDetails.availability_status === "AVAILABLE" ? "green" : "slate"}>
                      {doctorDetails.availability_status}
                    </Badge>
                  </div>
                  <div className="border-t border-slate-100 pt-4 dark:border-slate-800 space-y-2 text-left text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Employee ID</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {doctorDetails.employee_id}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Department</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {doctorDetails.department || "General"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Experience</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {doctorDetails.years_experience} years
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Consultation Fee</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        ${doctorDetails.consultation_fee}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Professional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Mail className="h-3.5 w-3.5" /> Email Address
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {doctorDetails.email}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Phone className="h-3.5 w-3.5" /> Phone Number
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {doctorDetails.phone || "Not provided"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Shield className="h-3.5 w-3.5" /> License Number
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {doctorDetails.licenseNumber || doctorDetails.license_number || "N/A"}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                        <Briefcase className="h-3.5 w-3.5" /> Qualification
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {doctorDetails.qualification}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">
                      Biography
                    </h3>
                    <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">
                      {doctorDetails.biography || "No biography provided."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        // Doctor List view
        <>
          <PageHeader
            eyebrow="Hospital operations"
            title="Doctor Directory"
            description="Manage clinical staff, provision doctor credentials, edit profiles, and set availability."
            actions={
              <Button onClick={handleOpenAdd}>
                <Plus className="h-4 w-4" />
                Add Doctor
              </Button>
            }
          />

          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search doctors by name, code, department..."
                className="pl-11"
              />
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="py-8 text-center text-sm text-slate-500">Loading doctors...</div>
              ) : doctors.length ? (
                <PaginatedTable
                  rows={doctors}
                  pageSize={10}
                  columns={[
                    {
                      key: "fullName",
                      label: "Doctor Name",
                      render: (row) => (
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                            <Stethoscope className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {row.fullName || row.full_name}
                            </div>
                            <div className="text-xs text-slate-400">{row.employee_id}</div>
                          </div>
                        </div>
                      ),
                    },
                    { key: "specialization", label: "Specialization" },
                    { key: "qualification", label: "Qualification" },
                    {
                      key: "years_experience",
                      label: "Experience",
                      render: (row) => `${row.years_experience} yrs`,
                    },
                    {
                      key: "consultation_fee",
                      label: "Fee",
                      render: (row) => `$${row.consultation_fee}`,
                    },
                    {
                      key: "availability_status",
                      label: "Availability",
                      render: (row) => (
                        <Badge tone={row.availability_status === "AVAILABLE" ? "green" : "slate"}>
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
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenEdit(row)}
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl"
                            title="Edit profile"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggleAvailability(row)}
                            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded-xl"
                            title="Toggle Availability"
                          >
                            {row.availability_status === "AVAILABLE" ? (
                              <ToggleRight className="h-4 w-4 text-brand-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4 text-slate-400" />
                            )}
                          </button>
                        </div>
                      ),
                    },
                  ]}
                />
              ) : (
                <EmptyState
                  title="No doctors found"
                  description="No records match the current query."
                />
              )}
            </CardContent>
          </Card>
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
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Employee ID *
              </span>
              <Input
                value={form.employee_id}
                onChange={(e) =>
                  setForm((current) => ({ ...current, employee_id: e.target.value }))
                }
                placeholder="e.g. DOC-101"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Full Name *
              </span>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((current) => ({ ...current, fullName: e.target.value }))}
                placeholder="e.g. Dr. Jane Doe"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Email Address *
              </span>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
                placeholder="email@hospital.com"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Phone Number
              </span>
              <Input
                value={form.phone}
                onChange={(e) => setForm((current) => ({ ...current, phone: e.target.value }))}
                placeholder="e.g. +91 9876543210"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Specialization *
              </span>
              <Input
                value={form.specialization}
                onChange={(e) =>
                  setForm((current) => ({ ...current, specialization: e.target.value }))
                }
                placeholder="e.g. Cardiology"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Qualification *
              </span>
              <Input
                value={form.qualification}
                onChange={(e) =>
                  setForm((current) => ({ ...current, qualification: e.target.value }))
                }
                placeholder="e.g. MBBS, MD"
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Years of Experience
              </span>
              <Input
                type="number"
                value={form.years_experience}
                onChange={(e) =>
                  setForm((current) => ({ ...current, years_experience: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Consultation Fee ($)
              </span>
              <Input
                type="number"
                value={form.consultation_fee}
                onChange={(e) =>
                  setForm((current) => ({ ...current, consultation_fee: Number(e.target.value) }))
                }
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Department
              </span>
              <Input
                value={form.department}
                onChange={(e) => setForm((current) => ({ ...current, department: e.target.value }))}
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                License Number
              </span>
              <Input
                value={form.license_number}
                onChange={(e) =>
                  setForm((current) => ({ ...current, license_number: e.target.value }))
                }
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Availability Status
              </span>
              <select
                value={form.availability_status}
                onChange={(e) =>
                  setForm((current) => ({ ...current, availability_status: e.target.value }))
                }
                className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="UNAVAILABLE">UNAVAILABLE</option>
              </select>
            </div>
            {!editingId && (
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
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
              </div>
            )}
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Biography
            </span>
            <textarea
              value={form.biography}
              onChange={(e) => setForm((current) => ({ ...current, biography: e.target.value }))}
              rows={3}
              className="w-full p-4 rounded-2xl border border-slate-200 bg-white text-sm text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500/70"
              placeholder="Enter biographical notes..."
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingId ? "Update Doctor" : "Register Doctor"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
