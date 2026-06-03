import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Edit2,
  Eye,
  ArrowLeft,
  Calendar,
  User,
  Phone,
  Mail,
  FileText,
  Shield,
  Clock,
  AlertTriangle,
  FileUp,
  Activity,
  UserCheck,
  Stethoscope
} from "lucide-react";
import {
  listPatients,
  createPatient,
  updatePatient,
  getPatientSummary
} from "../services/patientService";
import {
  getMedicalHistory,
  createMedicalRecord,
  updateMedicalRecord
} from "../services/recordService";
import {
  listDocuments,
  uploadDocument,
  downloadDocument
} from "../services/documentService";
import { getUser } from "../services/session";
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { EmptyState } from "../components/ui/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { formatDate, formatDateTime, statusTone } from "../utils/formatters";

const SEVERITY_TONE = {
  mild: "teal",
  moderate: "yellow",
  severe: "red",
  critical: "red",
  anaphylactic: "red",
};

const initialForm = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  gender: "undisclosed",
  date_of_birth: "",
  blood_group: "",
  address: "",
  emergency_contact_name: "",
  emergency_contact_phone: "",
  insurance_provider: "",
  insurance_policy_number: "",
  password: "",
};

const initialRecordForm = {
  symptoms: "",
  diagnosis: "",
  treatment_plan: "",
  prescription: "",
  doctor_notes: "",
  follow_up_date: "",
  addAllergy: false,
  allergy_name: "",
  allergy_severity: "moderate",
  allergy_notes: "",
  addMedication: false,
  medication_name: "",
  medication_dosage: "",
  medication_frequency: "",
  medication_start_date: "",
  medication_end_date: "",
};

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);

  // Profile view states
  const [viewingPatientId, setViewingPatientId] = useState(null);
  const [patientSummary, setPatientSummary] = useState(null);
  const [profileTab, setProfileTab] = useState("overview"); // overview, emr, allergies, documents
  const [loadingProfile, setLoadingProfile] = useState(false);

  // EMR Creation States
  const [emrOpen, setEmrOpen] = useState(false);
  const [emrEditingId, setEmrEditingId] = useState(null);
  const [emrForm, setEmrForm] = useState(initialRecordForm);
  const [emrSubmitting, setEmrSubmitting] = useState(false);

  // Document Upload States
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState("report");
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [documentsList, setDocumentsList] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const currentUser = getUser();
  const isAdminOrStaff = ["super_admin", "hospital_admin", "admin", "receptionist"].includes(currentUser?.role);
  const isDoctorOrAdmin = ["doctor", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  async function load() {
    setLoading(true);
    try {
      const data = await listPatients(searchQuery);
      setPatients(data);
    } catch {
      toast.error("Unable to load patients list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!viewingPatientId) {
      load();
    }
  }, [searchQuery, viewingPatientId]);

  async function loadProfile(id) {
    setLoadingProfile(true);
    try {
      const summaryData = await getPatientSummary(id);
      setPatientSummary(summaryData);
      
      // Load documents in parallel
      setLoadingDocs(true);
      const docs = await listDocuments(id);
      setDocumentsList(docs);
      setLoadingDocs(false);
    } catch {
      toast.error("Unable to load patient profile details");
    } finally {
      setLoadingProfile(false);
    }
  }

  useEffect(() => {
    if (viewingPatientId) {
      loadProfile(viewingPatientId);
    }
  }, [viewingPatientId]);

  const handleOpenAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setOpen(true);
  };

  const handleOpenEdit = (patient) => {
    setForm({
      first_name: patient.first_name || "",
      last_name: patient.last_name || "",
      email: patient.email || "",
      phone: patient.phone || "",
      gender: patient.gender || "undisclosed",
      date_of_birth: patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : "",
      blood_group: patient.bloodGroup || "",
      address: patient.address || "",
      emergency_contact_name: patient.emergencyContactName || "",
      emergency_contact_phone: patient.emergencyContactPhone || "",
      insurance_provider: patient.insuranceProvider || "",
      insurance_policy_number: patient.insurancePolicyNumber || "",
      password: "",
    });
    setEditingId(patient.patient_id || patient.id);
    setOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) {
      toast.error("First Name, Last Name and Email are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        await updatePatient(editingId, form);
        toast.success("Patient profile updated");
      } else {
        await createPatient(form);
        toast.success("Patient created successfully");
      }
      setOpen(false);
      if (viewingPatientId === editingId) {
        loadProfile(viewingPatientId);
      }
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save patient");
    } finally {
      setSubmitting(false);
    }
  };

  // EMR Submit
  const handleEmrSubmit = async (e) => {
    e.preventDefault();
    if (!emrForm.symptoms || !emrForm.diagnosis || !emrForm.treatment_plan) {
      toast.error("Symptoms, Diagnosis, and Treatment Plan are required");
      return;
    }

    setEmrSubmitting(true);
    try {
      const payload = {
        patient_id: viewingPatientId,
        symptoms: emrForm.symptoms,
        diagnosis: emrForm.diagnosis,
        treatment_plan: emrForm.treatment_plan,
        prescription: emrForm.prescription,
        doctor_notes: emrForm.doctor_notes,
        follow_up_date: emrForm.follow_up_date || null,
      };

      if (emrForm.addAllergy && emrForm.allergy_name) {
        payload.allergy = {
          allergy_name: emrForm.allergy_name,
          severity: emrForm.allergy_severity,
          notes: emrForm.allergy_notes,
        };
      }

      if (emrForm.addMedication && emrForm.medication_name) {
        payload.medication = {
          medication_name: emrForm.medication_name,
          dosage: emrForm.medication_dosage,
          frequency: emrForm.medication_frequency,
          start_date: emrForm.medication_start_date || null,
          end_date: emrForm.medication_end_date || null,
        };
      }

      if (emrEditingId) {
        await updateMedicalRecord(emrEditingId, payload);
        toast.success("Medical record updated");
      } else {
        await createMedicalRecord(payload);
        toast.success("Medical record created successfully");
      }
      setEmrOpen(false);
      loadProfile(viewingPatientId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save medical record");
    } finally {
      setEmrSubmitting(false);
    }
  };

  const handleOpenAddEmr = () => {
    setEmrForm(initialRecordForm);
    setEmrEditingId(null);
    setEmrOpen(true);
  };

  const handleOpenEditEmr = (record) => {
    setEmrForm({
      symptoms: record.symptoms || record.chief_complaint || "",
      diagnosis: record.diagnosis || "",
      treatment_plan: record.treatment_plan || record.clinical_notes || "",
      prescription: record.prescription || "",
      doctor_notes: record.doctor_notes || "",
      follow_up_date: record.follow_up_date ? record.follow_up_date.split("T")[0] : "",
      addAllergy: false,
      allergy_name: "",
      allergy_severity: "moderate",
      allergy_notes: "",
      addMedication: false,
      medication_name: "",
      medication_dosage: "",
      medication_frequency: "",
      medication_start_date: "",
      medication_end_date: "",
    });
    setEmrEditingId(record.id);
    setEmrOpen(true);
  };

  // Document Upload
  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingDoc(true);
    try {
      await uploadDocument(viewingPatientId, uploadFile, uploadDocType);
      toast.success("Document uploaded successfully");
      setUploadFile(null);
      
      // Reload profile and document lists
      const summaryData = await getPatientSummary(viewingPatientId);
      setPatientSummary(summaryData);
      const docs = await listDocuments(viewingPatientId);
      setDocumentsList(docs);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDoc = async (doc) => {
    try {
      await downloadDocument(doc.id, doc.file_name);
      toast.success("Downloading document...");
    } catch (error) {
      toast.error("Failed to download document");
    }
  };

  if (viewingPatientId) {
    if (loadingProfile || !patientSummary) {
      return (
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading patient profile...</div>
        </div>
      );
    }

    const { profile, records, timeline } = patientSummary;
    const allergies = patientSummary.allergies || [];
    const medications = patientSummary.medications || [];

    return (
      <div className="space-y-6">
        {/* Back Button and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={() => setViewingPatientId(null)}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to patients directory
          </button>
          
          <div className="flex items-center gap-2">
            {isAdminOrStaff && (
              <Button variant="ghost" onClick={() => handleOpenEdit(profile)}>
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
            {isDoctorOrAdmin && (
              <Button onClick={handleOpenAddEmr}>
                <Plus className="h-4 w-4" />
                Add Medical Record
              </Button>
            )}
          </div>
        </div>

        {/* Profile Summary Header Card */}
        <Card className="overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-brand-600 to-tealish-600" />
          <CardContent className="pt-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-3xl bg-brand-50 text-brand-600 dark:bg-brand-950/50 dark:text-brand-400">
                  <User className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                    {profile.fullName}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {profile.medicalRecordNumber}
                    </span>
                    <span>•</span>
                    <span>{profile.gender ? profile.gender.toUpperCase() : "Gender undisclosed"}</span>
                    <span>•</span>
                    <span>DOB: {formatDate(profile.dateOfBirth)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-4 md:border-none md:pt-0">
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-center dark:bg-slate-900/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Blood Group
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {profile.bloodGroup || "N/A"}
                  </div>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-2 text-center dark:bg-slate-900/60">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                    Records Count
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                    {records?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profile Sub-Tabs */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
          {[
            { id: "overview", label: "Overview & Timeline" },
            { id: "emr", label: "Medical History (EMR)" },
            { id: "allergies", label: "Allergies & Medications" },
            { id: "documents", label: "Medical Documents" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProfileTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold capitalize transition-all ${
                profileTab === tab.id
                  ? "border-b-2 border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Overview Tab */}
        {profileTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Contact & Insurance Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.email}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.phone || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40 sm:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Address
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.address || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Emergency Contact Name
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.emergencyContactName || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Emergency Contact Phone
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.emergencyContactPhone || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
                    <Shield className="h-3.5 w-3.5" /> Insurance Provider
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.insuranceProvider || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-900/40">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Insurance Policy Number
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.insurancePolicyNumber || "Not provided"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline Activities</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {timeline && timeline.length ? (
                  timeline.map((item, idx) => (
                    <div
                      key={idx}
                      className="relative border-l border-slate-200 pb-4 pl-4 last:pb-0 dark:border-slate-800"
                    >
                      <div className="absolute -left-1.5 top-1 h-3 w-3 rounded-full bg-brand-600 dark:bg-brand-400" />
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={statusTone(item.status)}>{item.type}</Badge>
                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                          <Clock className="h-3 w-3" /> {formatDateTime(item.occurredAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.summary}
                      </p>
                      <p className="text-xs text-slate-400">By: {item.actor}</p>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="Timeline empty"
                    description="No actions or clinical records found on the timeline."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profile EMR Tab */}
        {profileTab === "emr" && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Clinical Medical Records</CardTitle>
              {isDoctorOrAdmin && (
                <Button size="sm" onClick={handleOpenAddEmr}>
                  <Plus className="h-4 w-4" /> Add Record
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {records && records.length ? (
                records.map((record) => (
                  <div
                    key={record.id}
                    className="relative rounded-3xl border border-slate-100 p-5 shadow-sm dark:border-slate-900/60 dark:bg-slate-900/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-slate-900 dark:text-white">
                          Diagnosis: {record.diagnosis}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>Doctor: {record.doctor_name || record.doctorName}</span>
                          <span>•</span>
                          <span>Specialization: {record.doctor_specialization || record.specialization}</span>
                          <span>•</span>
                          <span>Date: {formatDateTime(record.created_at || record.createdAt)}</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isDoctorOrAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditEmr(record)}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Chief Complaint / Symptoms
                        </div>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-300">
                          {record.symptoms || record.chief_complaint || "None recorded"}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950/60">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Treatment Plan / Notes
                        </div>
                        <p className="mt-1 text-sm text-slate-800 dark:text-slate-300">
                          {record.treatment_plan || record.clinical_notes || "None recorded"}
                        </p>
                      </div>
                    </div>

                    {record.prescription && (
                      <div className="mt-4 rounded-2xl border border-brand-100 bg-brand-50/20 p-4 dark:border-brand-900/30 dark:bg-brand-950/10">
                        <div className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                          Prescription / Dosage details
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                          {record.prescription}
                        </p>
                      </div>
                    )}

                    {record.doctor_notes && (
                      <div className="mt-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                          Clinician Private Notes
                        </div>
                        <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-400">
                          {record.doctor_notes}
                        </p>
                      </div>
                    )}

                    {record.follow_up_date && (
                      <div className="mt-4 flex items-center gap-2 text-sm">
                        <Badge tone="yellow">Follow-up date</Badge>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {formatDate(record.follow_up_date)}
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No EMR records found"
                  description="Consultation records and clinical history will appear here once added."
                />
              )}
            </CardContent>
          </Card>
        )}

        {/* Profile Allergies & Medications Tab */}
        {profileTab === "allergies" && (
          <div className="grid gap-6 md:grid-cols-2">
            {/* Allergies Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" /> Allergies List
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {allergies && allergies.length ? (
                  allergies.map((allergy) => (
                    <div
                      key={allergy.id}
                      className="rounded-2xl border border-slate-100 p-4 dark:border-slate-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {allergy.allergy_name || allergy.allergen}
                        </span>
                        <Badge tone={SEVERITY_TONE[allergy.severity] || "neutral"}>
                          {allergy.severity}
                        </Badge>
                      </div>
                      {allergy.notes && (
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Notes: {allergy.notes}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No Allergies documented"
                    description="No allergies have been registered for this patient."
                  />
                )}
              </CardContent>
            </Card>

            {/* Medications History Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-brand-600" /> Medication History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {medications && medications.length ? (
                  medications.map((med) => (
                    <div
                      key={med.id}
                      className="rounded-2xl border border-slate-100 p-4 dark:border-slate-900/60"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {med.medication_name}
                        </span>
                        <Badge tone="teal">{med.dosage}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div>Frequency: {med.frequency}</div>
                        <div>
                          Duration: {med.start_date ? formatDate(med.start_date) : "N/A"} -{" "}
                          {med.end_date ? formatDate(med.end_date) : "Ongoing"}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No Medications registered"
                    description="No historical medication entries have been recorded."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Profile Documents Tab */}
        {profileTab === "documents" && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Medical Reports & Files</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingDocs ? (
                  <div className="py-8 text-center text-sm text-slate-400">Loading documents...</div>
                ) : documentsList && documentsList.length ? (
                  documentsList.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 p-4 dark:border-slate-800"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-slate-100 p-2 dark:bg-slate-900">
                          <FileText className="h-5 w-5 text-slate-500" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {doc.file_name}
                          </div>
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Type: {doc.document_type} • Uploaded {formatDateTime(doc.uploaded_at)}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownloadDoc(doc)}
                        className="text-sm font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                      >
                        Download
                      </button>
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title="No documents uploaded"
                    description="Patient has no clinical reports, imaging, or lab tests uploaded."
                  />
                )}
              </CardContent>
            </Card>

            {isDoctorOrAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Upload Document</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUploadDoc} className="space-y-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Document Category / Type
                      </span>
                      <select
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value)}
                        className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                      >
                        <option value="report">Lab Report</option>
                        <option value="prescription">Prescription Slip</option>
                        <option value="imaging">Imaging (X-ray, MRI)</option>
                        <option value="insurance">Insurance Claim</option>
                        <option value="other">Other Attachment</option>
                      </select>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Select File (PDF, PNG, JPG)
                      </span>
                      <Input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={(e) => setUploadFile(e.target.files[0])}
                        required
                        className="mt-1"
                      />
                    </div>

                    <Button type="submit" loading={uploadingDoc} className="w-full">
                      <FileUp className="h-4 w-4" /> Upload Report
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Medical Record Modal */}
        <Modal
          open={emrOpen}
          onClose={() => setEmrOpen(false)}
          title={emrEditingId ? "Edit Medical Record" : "Create New Medical Record"}
        >
          <form onSubmit={handleEmrSubmit} className="space-y-4">
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Chief Complaint / Symptoms *
              </span>
              <textarea
                value={emrForm.symptoms}
                onChange={(e) => setEmrForm((c) => ({ ...c, symptoms: e.target.value }))}
                rows={3}
                placeholder="List patients symptoms and chief complaints"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Diagnosis *
              </span>
              <Input
                placeholder="e.g. Chronic Hypertension, Type II Diabetes"
                value={emrForm.diagnosis}
                onChange={(e) => setEmrForm((c) => ({ ...c, diagnosis: e.target.value }))}
                required
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Treatment Plan & Notes *
              </span>
              <textarea
                value={emrForm.treatment_plan}
                onChange={(e) => setEmrForm((c) => ({ ...c, treatment_plan: e.target.value }))}
                rows={3}
                placeholder="Describe treatment procedures, clinical notes, lifestyle changes"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                required
              />
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                Prescription
              </span>
              <textarea
                value={emrForm.prescription}
                onChange={(e) => setEmrForm((c) => ({ ...c, prescription: e.target.value }))}
                rows={2}
                placeholder="e.g. Metformin 500mg - 1 daily after dinner"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Doctor Notes
                </span>
                <Input
                  placeholder="Internal notes or comments"
                  value={emrForm.doctor_notes}
                  onChange={(e) => setEmrForm((c) => ({ ...c, doctor_notes: e.target.value }))}
                />
              </div>
              <div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  Follow-up Date
                </span>
                <Input
                  type="date"
                  value={emrForm.follow_up_date}
                  onChange={(e) => setEmrForm((c) => ({ ...c, follow_up_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Inline Allergy Checkbox and Form (Only on Create Record) */}
            {!emrEditingId && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={emrForm.addAllergy}
                    onChange={(e) => setEmrForm((c) => ({ ...c, addAllergy: e.target.checked }))}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Add new allergy record inline
                  </span>
                </label>

                {emrForm.addAllergy && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="sm:col-span-2">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Allergen *</span>
                      <Input
                        placeholder="e.g. Peanut, Penicillin"
                        value={emrForm.allergy_name}
                        onChange={(e) => setEmrForm((c) => ({ ...c, allergy_name: e.target.value }))}
                        required={emrForm.addAllergy}
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Severity</span>
                      <select
                        value={emrForm.allergy_severity}
                        onChange={(e) => setEmrForm((c) => ({ ...c, allergy_severity: e.target.value }))}
                        className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="anaphylactic">Anaphylactic</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Reaction / Notes</span>
                      <Input
                        placeholder="e.g. Swelling, hives"
                        value={emrForm.allergy_notes}
                        onChange={(e) => setEmrForm((c) => ({ ...c, allergy_notes: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Inline Medication Checkbox and Form (Only on Create Record) */}
            {!emrEditingId && (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-800">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={emrForm.addMedication}
                    onChange={(e) => setEmrForm((c) => ({ ...c, addMedication: e.target.checked }))}
                    className="rounded text-brand-600"
                  />
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Add current medication to history inline
                  </span>
                </label>

                {emrForm.addMedication && (
                  <div className="mt-4 space-y-3">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="sm:col-span-2">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Medication Name *</span>
                        <Input
                          placeholder="e.g. Metformin, Lisinopril"
                          value={emrForm.medication_name}
                          onChange={(e) => setEmrForm((c) => ({ ...c, medication_name: e.target.value }))}
                          required={emrForm.addMedication}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Dosage *</span>
                        <Input
                          placeholder="e.g. 500mg, 10mg"
                          value={emrForm.medication_dosage}
                          onChange={(e) => setEmrForm((c) => ({ ...c, medication_dosage: e.target.value }))}
                          required={emrForm.addMedication}
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Frequency *</span>
                        <Input
                          placeholder="e.g. Once daily, Twice daily"
                          value={emrForm.medication_frequency}
                          onChange={(e) => setEmrForm((c) => ({ ...c, medication_frequency: e.target.value }))}
                          required={emrForm.addMedication}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Start Date</span>
                        <Input
                          type="date"
                          value={emrForm.medication_start_date}
                          onChange={(e) => setEmrForm((c) => ({ ...c, medication_start_date: e.target.value }))}
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">End Date</span>
                        <Input
                          type="date"
                          value={emrForm.medication_end_date}
                          onChange={(e) => setEmrForm((c) => ({ ...c, medication_end_date: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={() => setEmrOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={emrSubmitting}>
                Save Record
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Patient list"
        title="Patients Management"
        description="Search, view profile timelines, and provision patient records."
        actions={
          isAdminOrStaff && (
            <Button onClick={handleOpenAdd}>
              <Plus className="h-4 w-4" />
              Add Patient
            </Button>
          )
        }
      />

      <div className="flex max-w-md items-center gap-2">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11"
            placeholder="Search by name, email, or MRN"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading patients...</div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={patients}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No patients found"
                description="Try adjusting your search criteria or register a new patient."
              />
            }
            columns={[
              {
                key: "medicalRecordNumber",
                label: "MRN",
                render: (row) => <span className="font-semibold text-slate-900 dark:text-slate-200">{row.medicalRecordNumber}</span>
              },
              {
                key: "full_name",
                label: "Name",
                render: (row) => row.fullName || `${row.first_name} ${row.last_name}`
              },
              {
                key: "gender",
                label: "Gender",
                render: (row) => row.gender ? row.gender.toUpperCase() : "N/A"
              },
              {
                key: "dateOfBirth",
                label: "DOB",
                render: (row) => formatDate(row.dateOfBirth)
              },
              { key: "phone", label: "Phone" },
              { key: "email", label: "Email" },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setViewingPatientId(row.patient_id || row.id)}
                      className="text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
                      title="Open Patient Profile"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isAdminOrStaff && (
                      <button
                        onClick={() => handleOpenEdit(row)}
                        className="text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300"
                        title="Edit Patient"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Add / Edit Patient Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit Patient Profile" : "Register Patient Account"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">First Name *</span>
              <Input
                placeholder="Ramesh"
                value={form.first_name}
                onChange={(e) => setForm((c) => ({ ...c, first_name: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Last Name *</span>
              <Input
                placeholder="Kumar"
                value={form.last_name}
                onChange={(e) => setForm((c) => ({ ...c, last_name: e.target.value }))}
                required
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Email *</span>
              <Input
                type="email"
                placeholder="ramesh@gmail.com"
                value={form.email}
                onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                required
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Phone</span>
              <Input
                placeholder="+91 90000 00000"
                value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Gender</span>
              <select
                value={form.gender}
                onChange={(e) => setForm((c) => ({ ...c, gender: e.target.value }))}
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="undisclosed">Undisclosed</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Date of Birth</span>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => setForm((c) => ({ ...c, date_of_birth: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Blood Group</span>
              <Input
                placeholder="O+"
                value={form.blood_group}
                onChange={(e) => setForm((c) => ({ ...c, blood_group: e.target.value }))}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Address</span>
            <textarea
              value={form.address}
              onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
              rows={2}
              placeholder="Residential address"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Emergency Contact Name</span>
              <Input
                placeholder="Sita Kumar"
                value={form.emergency_contact_name}
                onChange={(e) => setForm((c) => ({ ...c, emergency_contact_name: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Emergency Contact Phone</span>
              <Input
                placeholder="+91 90000 11111"
                value={form.emergency_contact_phone}
                onChange={(e) => setForm((c) => ({ ...c, emergency_contact_phone: e.target.value }))}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Insurance Provider</span>
              <Input
                placeholder="Star Health"
                value={form.insurance_provider}
                onChange={(e) => setForm((c) => ({ ...c, insurance_provider: e.target.value }))}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Insurance Policy Number</span>
              <Input
                placeholder="POL-12345"
                value={form.insurance_policy_number}
                onChange={(e) => setForm((c) => ({ ...c, insurance_policy_number: e.target.value }))}
              />
            </label>
          </div>

          {!editingId && (
            <label className="block">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Password</span>
              <Input
                type="password"
                placeholder="Optional (Default: Password@123)"
                value={form.password}
                onChange={(e) => setForm((c) => ({ ...c, password: e.target.value }))}
              />
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              {editingId ? "Save Changes" : "Register Patient"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
