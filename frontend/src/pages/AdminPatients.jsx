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
  UserX,
  Stethoscope,
  Download,
  Beaker
} from "lucide-react";
import {
  listPatients,
  createPatient,
  updatePatient,
  getPatientSummary,
  getAbhaDetails,
  linkAbha,
  verifyAbha,
  unlinkAbha,
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
import {
  getPatientConsents,
  grantConsent,
  revokeConsent as revokePatientConsent,
} from "../services/abdmConsentService";
import {
  getCareContexts,
  linkCareContext,
  unlinkCareContext as unlinkPatientCareContext,
} from "../services/abdmCareContextService";
import {
  getPmjayDetails,
  linkPmjay,
  verifyPmjay,
  unlinkPmjay,
} from "../services/pmjayService";
import {
  getClaimsByPatient,
  createClaim as createPmjayClaim,
  submitClaim as submitPmjayClaim,
  updateClaimStatus as updatePmjayClaimStatus,
} from "../services/pmjayClaimService";
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
  status: "active"
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

function PatientsListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-11 w-72" />
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-36" />
        <Skeleton className="h-11 w-36" />
      </div>
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

function PatientProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-10 w-48" />
        <div className="flex gap-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85 h-40 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-3xl animate-pulse" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/85 h-80">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950/85 h-80">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    </div>
  );
}

export default function AdminPatients() {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Profile view states
  const [viewingPatientId, setViewingPatientId] = useState(null);
  const [patientSummary, setPatientSummary] = useState(null);
  const [profileTab, setProfileTab] = useState("overview"); // overview, emr, allergies, documents
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Advanced Filters
  const [filterGender, setFilterGender] = useState("all");
  const [filterBloodGroup, setFilterBloodGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

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


  // ABHA Integration States
  const [abhaDetails, setAbhaDetails] = useState(undefined); // undefined = not loaded, null = not linked
  const [abhaLoading, setAbhaLoading] = useState(false);
  const [abhaError, setAbhaError] = useState(null);
  const [abhaLinkForm, setAbhaLinkForm] = useState({ abha_number: "", abha_address: "" });
  const [abhaLinkSubmitting, setAbhaLinkSubmitting] = useState(false);
  const [abhaVerifySubmitting, setAbhaVerifySubmitting] = useState(false);
  const [abhaUnlinkSubmitting, setAbhaUnlinkSubmitting] = useState(false);

  const currentUser = getUser();
  const isAdminOrStaff = ["super_admin", "hospital_admin", "admin", "receptionist"].includes(currentUser?.role);
  const isDoctorOrAdmin = ["doctor", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  const canReadAbha   = ["doctor", "patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canLinkAbha   = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canVerifyAbha = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canUnlinkAbha = ["super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  // ABDM Consent States
  const [consentData,    setConsentData]    = useState(null);   // null = not yet loaded
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError,   setConsentError]   = useState(null);
  const [consentGrantForm, setConsentGrantForm] = useState({ consent_type: "general", expires_at: "" });
  const [consentGranting,  setConsentGranting]  = useState(false);
  const [consentRevoking,  setConsentRevoking]  = useState(null); // stores consentId being revoked

  const canReadConsent   = ["doctor", "patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canGrantConsent  = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canRevokeConsent = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  // ABDM Care Context States
  const [careContextData,    setCareContextData]    = useState(null);
  const [careContextLoading, setCareContextLoading] = useState(false);
  const [careContextError,   setCareContextError]   = useState(null);
  const [careContextLinkForm, setCareContextLinkForm] = useState({ care_context_reference: "", display_name: "" });
  const [careContextLinking,  setCareContextLinking]  = useState(false);
  const [careContextUnlinking, setCareContextUnlinking] = useState(null); // contextId being unlinked

  const canReadCareContext   = ["doctor", "patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canLinkCareContext   = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canUnlinkCareContext = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  // PM-JAY States
  const [pmjayDetails,    setPmjayDetails]    = useState(undefined); // undefined = not loaded
  const [pmjayLoading,    setPmjayLoading]    = useState(false);
  const [pmjayError,      setPmjayError]      = useState(null);
  const [pmjayLinkForm,   setPmjayLinkForm]   = useState({ pmjay_id: "", beneficiary_name: "" });
  const [pmjayLinkSubmitting,   setPmjayLinkSubmitting]   = useState(false);
  const [pmjayVerifySubmitting, setPmjayVerifySubmitting] = useState(false);
  const [pmjayUnlinkSubmitting, setPmjayUnlinkSubmitting] = useState(false);

  const canReadPmjay   = ["doctor", "receptionist", "patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canLinkPmjay   = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canVerifyPmjay = ["patient_manager", "super_admin", "hospital_admin", "admin"].includes(currentUser?.role);
  const canUnlinkPmjay = ["super_admin", "hospital_admin", "admin"].includes(currentUser?.role);

  // PM-JAY Claim States
  const [pmjayClaimsData,       setPmjayClaimsData]       = useState(null);
  const [pmjayClaimsLoading,    setPmjayClaimsLoading]    = useState(false);
  const [pmjayClaimsError,      setPmjayClaimsError]      = useState(null);
  const [pmjayCreateForm,       setPmjayCreateForm]       = useState({ claim_amount: "", appointment_id: "" });
  const [pmjayCreateSubmitting, setPmjayCreateSubmitting] = useState(false);
  const [pmjaySubmitting,       setPmjaySubmitting]       = useState(null);  // claimId being submitted
  const [pmjayStatusUpdating,   setPmjayStatusUpdating]   = useState(null);  // claimId being updated
  const [pmjayRejectForm,       setPmjayRejectForm]       = useState({ claimId: null, reason: "" });

  const canReadClaim   = ["doctor", "patient_manager", "super_admin", "hospital_admin", "admin", "billing_admin"].includes(currentUser?.role);
  const canCreateClaim = ["patient_manager", "super_admin", "hospital_admin", "admin", "billing_admin"].includes(currentUser?.role);
  const canSubmitClaim = ["super_admin", "hospital_admin", "admin", "billing_admin"].includes(currentUser?.role);
  const canUpdateClaim = ["super_admin", "hospital_admin", "admin", "billing_admin"].includes(currentUser?.role);


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
      // Reset ABHA state when switching to a different patient
      setAbhaDetails(undefined);
      setAbhaError(null);
      // Reset consent state
      setConsentData(null);
      setConsentError(null);
      // Reset care context state
      setCareContextData(null);
      setCareContextError(null);
      // Reset PM-JAY state
      setPmjayDetails(undefined);
      setPmjayError(null);
      // Reset PM-JAY Claim state
      setPmjayClaimsData(null);
      setPmjayClaimsError(null);
    }
  }, [viewingPatientId]);

  // Load ABHA details when the ABHA tab is activated
  useEffect(() => {
    if (profileTab === "abha" && viewingPatientId && canReadAbha && abhaDetails === undefined) {
      setAbhaLoading(true);
      setAbhaError(null);
      getAbhaDetails(viewingPatientId)
        .then((res) => setAbhaDetails(res.abha ?? null))
        .catch((err) => setAbhaError(err.response?.data?.message || "Failed to load ABHA details"))
        .finally(() => setAbhaLoading(false));
    }
  }, [profileTab, viewingPatientId, canReadAbha]);

  // Load care contexts when the ABHA tab is activated (care context lives in ABHA tab)
  useEffect(() => {
    if (profileTab === "abha" && viewingPatientId && canReadCareContext && !careContextData) {
      setCareContextLoading(true);
      setCareContextError(null);
      getCareContexts(viewingPatientId)
        .then((res) => setCareContextData(res))
        .catch((err) => setCareContextError(err.response?.data?.message || "Failed to load care contexts"))
        .finally(() => setCareContextLoading(false));
    }
  }, [profileTab, viewingPatientId, canReadCareContext]);

  // Load consent history when the consent tab is activated
  useEffect(() => {
    if (profileTab === "consent" && viewingPatientId && canReadConsent && !consentData) {
      setConsentLoading(true);
      setConsentError(null);
      getPatientConsents(viewingPatientId)
        .then((res) => setConsentData(res))
        .catch((err) => setConsentError(err.response?.data?.message || "Failed to load consent records"))
        .finally(() => setConsentLoading(false));
    }
  }, [profileTab, viewingPatientId, canReadConsent]);

  // Load PM-JAY details when the PM-JAY tab is activated
  useEffect(() => {
    if (profileTab === "pmjay" && viewingPatientId && canReadPmjay && pmjayDetails === undefined) {
      setPmjayLoading(true);
      setPmjayError(null);
      getPmjayDetails(viewingPatientId)
        .then((res) => setPmjayDetails(res.pmjay ?? null))
        .catch((err) => setPmjayError(err.response?.data?.message || "Failed to load PM-JAY details"))
        .finally(() => setPmjayLoading(false));
    }
  }, [profileTab, viewingPatientId, canReadPmjay]);

  // Load PM-JAY claims when the claims tab is activated
  useEffect(() => {
    if (profileTab === "pmjay-claims" && viewingPatientId && canReadClaim && !pmjayClaimsData) {
      setPmjayClaimsLoading(true);
      setPmjayClaimsError(null);
      getClaimsByPatient(viewingPatientId)
        .then((res) => setPmjayClaimsData(res.claims ?? []))
        .catch((err) => setPmjayClaimsError(err.response?.data?.message || "Failed to load PM-JAY claims"))
        .finally(() => setPmjayClaimsLoading(false));
    }
  }, [profileTab, viewingPatientId, canReadClaim]);

  const handleOpenAdd = () => {
    setForm(initialForm);
    setEditingId(null);
    setErrors({});
    setOpen(true);
  };

  const handleOpenEdit = (patient) => {
    const nameParts = (patient.fullName || "").trim().split(/\s+/);
    const first_name = patient.first_name || nameParts[0] || "";
    const last_name = patient.last_name || nameParts.slice(1).join(" ") || "";

    setForm({
      first_name,
      last_name,
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
      status: patient.status || "active",
      password: "",
    });
    setEditingId(patient.patient_id || patient.id);
    setErrors({});
    setOpen(true);
  };

  const handleInputChange = (field, value) => {
    setForm(current => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const formErrors = {};
    if (!form.first_name || !form.first_name.trim()) {
      formErrors.first_name = "First name is required";
    } else if (form.first_name.trim().length < 2) {
      formErrors.first_name = "First name must be at least 2 characters";
    }

    if (!form.last_name || !form.last_name.trim()) {
      formErrors.last_name = "Last name is required";
    } else if (form.last_name.trim().length < 2) {
      formErrors.last_name = "Last name must be at least 2 characters";
    }

    if (!form.email || !form.email.trim()) {
      formErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      formErrors.email = "Invalid email format";
    }

    if (form.phone && form.phone.trim().length > 0 && form.phone.trim().length < 8) {
      formErrors.phone = "Phone number must be at least 8 digits";
    }

    if (form.emergency_contact_phone && form.emergency_contact_phone.trim().length > 0 && form.emergency_contact_phone.trim().length < 8) {
      formErrors.emergency_contact_phone = "Emergency contact phone must be at least 8 digits";
    }

    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      toast.error("Please correct the errors on the form");
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

  const handleToggleStatus = async (patient) => {
    const newStatus = patient.status === "active" ? "inactive" : "active";
    try {
      const nameParts = (patient.fullName || "").trim().split(/\s+/);
      const first_name = patient.first_name || nameParts[0] || "";
      const last_name = patient.last_name || nameParts.slice(1).join(" ") || "";
      
      const payload = {
        first_name,
        last_name,
        email: patient.email,
        phone: patient.phone || "",
        gender: patient.gender || "undisclosed",
        date_of_birth: patient.dateOfBirth ? patient.dateOfBirth.split("T")[0] : null,
        blood_group: patient.bloodGroup || "",
        address: patient.address || "",
        emergency_contact_name: patient.emergencyContactName || "",
        emergency_contact_phone: patient.emergencyContactPhone || "",
        insurance_provider: patient.insuranceProvider || "",
        insurance_policy_number: patient.insurancePolicyNumber || "",
        status: newStatus
      };
      
      await updatePatient(patient.patient_id || patient.id, payload);
      toast.success(`Patient account ${newStatus === "active" ? "activated" : "deactivated"}`);
      await load();
      if (viewingPatientId === (patient.patient_id || patient.id)) {
        loadProfile(viewingPatientId);
      }
    } catch (error) {
      toast.error("Failed to toggle status: " + (error.response?.data?.message || error.message));
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
      doctor_notes: record.doctor_notes || record.notes || "",
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
      return <PatientProfileSkeleton />;
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
            className="group flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white/60 px-4.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-slate-300 hover:bg-white dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-300 dark:hover:bg-neutral-100/20 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            <span>Back to patients directory</span>
          </button>
          
          <div className="flex items-center gap-2">
            <Button
              variant={profile.status === "active" ? "ghost" : "default"}
              onClick={() => handleToggleStatus(profile)}
              className={`flex items-center gap-2 rounded-xl border ${
                profile.status === "active"
                  ? "border-red-200 bg-red-50/10 text-red-650 hover:bg-red-50/30 dark:border-red-950/20 dark:text-red-400"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
            >
              {profile.status === "active" ? (
                <>
                  <UserX className="h-4 w-4" />
                  Deactivate Account
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Activate Account
                </>
              )}
            </Button>
            {isAdminOrStaff && (
              <Button variant="ghost" onClick={() => handleOpenEdit(profile)}>
                <Edit2 className="h-4 w-4" />
                Edit Profile
              </Button>
            )}
            {isDoctorOrAdmin && (
              <Button onClick={handleOpenAddEmr} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
                <Plus className="h-4 w-4" />
                Add Medical Record
              </Button>
            )}
          </div>
        </div>

        {/* Profile Summary Header Card */}
        <div className="relative overflow-hidden rounded-[24px] border border-slate-200/60 bg-white shadow-premium dark:border-neutral-200/10 dark:bg-neutral-100/20">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-brand-600 to-tealish-600" />
          <div className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-tr from-brand-600 to-tealish-500 font-extrabold text-2xl text-white shadow-premium-glow">
                  {getInitials(profile.fullName)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-black tracking-tight text-slate-950 dark:text-white">
                      {profile.fullName}
                    </h2>
                    <Badge tone={profile.status === "active" ? "teal" : "red"}>
                      {profile.status === "active" ? "Active" : "Inactive"}
                    </Badge>
                    {/* ABHA status badge — shown only when data is available */}
                    {abhaDetails !== undefined && (
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          abhaDetails?.verificationStatus === "verified"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800/40"
                            : abhaDetails
                            ? "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40"
                            : "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-neutral-200/5 dark:text-neutral-500 dark:border-neutral-200/10"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          abhaDetails?.verificationStatus === "verified" ? "bg-emerald-500" :
                          abhaDetails ? "bg-amber-500" : "bg-slate-400"
                        }`} />
                        {abhaDetails?.verificationStatus === "verified"
                          ? "ABHA Verified"
                          : abhaDetails
                          ? `ABHA ${abhaDetails.verificationStatus}`
                          : "ABHA Not Linked"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-neutral-500">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-neutral-100/40 px-2 py-0.5 rounded-lg">
                      {profile.medicalRecordNumber}
                    </span>
                    <span>•</span>
                    <span className="capitalize">{profile.gender ? profile.gender : "Gender undisclosed"}</span>
                    <span>•</span>
                    <span>DOB: {formatDate(profile.dateOfBirth)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4 border-t border-slate-100 pt-4 md:border-none md:pt-0">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-3 text-center dark:border-neutral-200/5 dark:bg-neutral-100/5 min-w-[100px]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                    Blood Group
                  </div>
                  <div className="mt-1 text-lg font-black text-brand-600 dark:text-brand-400">
                    {profile.bloodGroup || "N/A"}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/50 px-5 py-3 text-center dark:border-neutral-200/5 dark:bg-neutral-100/5 min-w-[100px]">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-neutral-500">
                    Records Count
                  </div>
                  <div className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                    {records?.length || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Sub-Tabs */}
        <div className="flex flex-wrap gap-2 rounded-2xl bg-slate-100/80 p-1.5 dark:bg-neutral-200/5 max-w-max">
          {[
            { id: "overview", label: "Overview & Timeline" },
            { id: "emr", label: "Clinical EMR" },
            { id: "allergies", label: "Allergies & Medications" },
            { id: "documents", label: "Medical Files" },
            ...(canReadAbha    ? [{ id: "abha",    label: "ABHA Identity" }]    : []),
            ...(canReadConsent ? [{ id: "consent", label: "ABDM Consent" }]     : []),
            ...(canReadPmjay  ? [{ id: "pmjay",        label: "PM-JAY" }]           : []),
            ...(canReadClaim  ? [{ id: "pmjay-claims", label: "PM-JAY Claims" }]    : []),
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setProfileTab(tab.id)}
              className={`rounded-xl px-4.5 py-2 text-sm font-semibold transition-all duration-200 ${
                profileTab === tab.id
                  ? "bg-white text-brand-700 shadow-sm dark:bg-neutral-100 dark:text-white"
                  : "text-slate-500 hover:bg-white/40 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-neutral-100/5 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Overview Tab */}
        {profileTab === "overview" && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle>Contact & Insurance Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    <Mail className="h-4 w-4 text-brand-500" /> Email
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white break-all">
                    {profile.email}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    <Phone className="h-4 w-4 text-brand-500" /> Phone
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.phone || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200 sm:col-span-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    Address
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.address || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    Emergency Contact Name
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.emergencyContactName || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    Emergency Contact Phone
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.emergencyContactPhone || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    <Shield className="h-4 w-4 text-teal-500" /> Insurance Provider
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.insuranceProvider || "Not provided"}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 hover:bg-slate-50 dark:border-neutral-200/5 dark:bg-neutral-100/5 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                    Insurance Policy Number
                  </div>
                  <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                    {profile.insurancePolicyNumber || "Not provided"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle>Timeline Activities</CardTitle>
              </CardHeader>
              <CardContent className="relative pl-6 space-y-6">
                <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-slate-100 dark:bg-neutral-200/5" />
                {timeline && timeline.length ? (
                  timeline.map((item, idx) => {
                    let IconComponent = Activity;
                    if (item.type?.includes("EMR") || item.type?.includes("RECORD")) {
                      IconComponent = Stethoscope;
                    } else if (item.type?.includes("DOCUMENT") || item.type?.includes("REPORT")) {
                      IconComponent = FileText;
                    } else if (item.type?.includes("LAB")) {
                      IconComponent = Beaker;
                    }
                    return (
                      <div key={idx} className="relative pl-8 pb-2 last:pb-0">
                        {/* Circle Hub */}
                        <div className="absolute -left-3.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-neutral-200/10 dark:bg-neutral-100">
                          <IconComponent className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <Badge tone={statusTone(item.status)}>{item.type?.replace("_", " ")}</Badge>
                            <span className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-neutral-500">
                              <Clock className="h-3 w-3" /> {formatDateTime(item.occurredAt)}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.summary}
                          </p>
                          <p className="text-xs text-slate-400 dark:text-neutral-500">
                            Logged by: <span className="font-medium text-slate-600 dark:text-slate-300">{item.actor}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })
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
          <Card className="rounded-[24px]">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Clinical Medical Records</CardTitle>
              {isDoctorOrAdmin && (
                <Button size="sm" onClick={handleOpenAddEmr} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
                  <Plus className="h-4 w-4" /> Add Record
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {records && records.length ? (
                records.map((record) => (
                  <div
                    key={record.id}
                    className="relative rounded-[24px] border border-slate-200 bg-white p-5 shadow-premium dark:border-neutral-200/10 dark:bg-neutral-100/20"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-neutral-200/5">
                      <div>
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                          <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                            Diagnosis: {record.diagnosis}
                          </h4>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-neutral-500">
                          <span className="flex items-center gap-1">
                            <User className="h-3.5 w-3.5" /> Dr. {record.doctor_name || record.doctorName} ({record.doctor_specialization || record.specialization})
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> {formatDateTime(record.created_at || record.createdAt)}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {isDoctorOrAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditEmr(record)}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit Record
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                        <div className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Chief Complaint / Symptoms
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-850 dark:text-slate-355">
                          {record.symptoms || record.chief_complaint || "None recorded"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                        <div className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Treatment Plan / Notes
                        </div>
                        <p className="mt-1.5 text-sm leading-relaxed text-slate-850 dark:text-slate-355">
                          {record.treatment_plan || record.clinical_notes || "None recorded"}
                        </p>
                      </div>
                    </div>

                    {record.prescription && (
                      <div className="mt-4 rounded-2xl border border-brand-100/30 bg-brand-50/30 p-4 dark:border-brand-500/20 dark:bg-brand-500/5">
                        <div className="text-xxs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                          Prescription / Dosage details
                        </div>
                        <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                          {record.prescription}
                        </p>
                      </div>
                    )}

                    {(record.doctor_notes || record.notes) && (
                      <div className="mt-4 border-t border-dashed border-slate-100 pt-3 dark:border-neutral-200/5">
                        <div className="text-xxs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Clinician Private Notes
                        </div>
                        <p className="mt-1.5 text-xs italic leading-relaxed text-slate-600 dark:text-slate-400">
                          {record.doctor_notes || record.notes}
                        </p>
                      </div>
                    )}

                    {record.follow_up_date && (
                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-yellow-50/50 px-3 py-1.5 text-xs text-yellow-700 dark:bg-yellow-950/20 dark:text-yellow-400 w-max">
                        <Calendar className="h-3.5 w-3.5 animate-pulse-subtle" />
                        <span>Next Follow-up: <span className="font-bold">{formatDate(record.follow_up_date)}</span></span>
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
            <Card className="rounded-[24px]">
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
                      className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {allergy.allergy_name || allergy.allergen}
                        </div>
                        {allergy.notes && (
                          <p className="mt-1.5 text-xs text-slate-500 dark:text-neutral-500 leading-relaxed">
                            {allergy.notes}
                          </p>
                        )}
                      </div>
                      <Badge tone={SEVERITY_TONE[allergy.severity] || "neutral"}>
                        {allergy.severity}
                      </Badge>
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
            <Card className="rounded-[24px]">
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
                      className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {med.medication_name}
                        </span>
                        <Badge tone="teal">{med.dosage}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-neutral-500 border-t border-slate-100/50 pt-2.5 dark:border-neutral-200/5">
                        <div><span className="font-medium">Frequency:</span> {med.frequency}</div>
                        <div>
                          <span className="font-medium">Duration:</span> {med.start_date ? formatDate(med.start_date) : "N/A"} -{" "}
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
            <Card className="rounded-[24px]">
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
                      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-slate-50/20 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5 hover:bg-slate-50/50 dark:hover:bg-neutral-100/10 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[280px] sm:max-w-md" title={doc.file_name}>
                            {doc.file_name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xxs text-slate-400 dark:text-neutral-500">
                            <Badge tone="teal" className="scale-95 origin-left uppercase">{doc.document_type}</Badge>
                            <span>•</span>
                            <span>Uploaded {formatDateTime(doc.uploaded_at)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDownloadDoc(doc)}
                        className="flex items-center gap-1 rounded-xl bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-100 dark:bg-brand-950/40 dark:text-brand-400 dark:hover:bg-brand-900/30 transition-all duration-200 shrink-0"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
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
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Upload Document</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUploadDoc} className="space-y-4">
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Document Category / Type
                      </span>
                      <Select
                        value={uploadDocType}
                        onChange={(e) => setUploadDocType(e.target.value)}
                        className="mt-1 bg-white"
                      >
                        <option value="report">Lab Report</option>
                        <option value="prescription">Prescription Slip</option>
                        <option value="imaging">Imaging (X-ray, MRI)</option>
                        <option value="insurance">Insurance Claim</option>
                        <option value="other">Other Attachment</option>
                      </Select>
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
                        className="mt-1 bg-white"
                      />
                    </div>

                    <Button type="submit" loading={uploadingDoc} className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
                      <FileUp className="h-4 w-4" /> Upload Report
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ABHA Identity Tab */}
        {profileTab === "abha" && canReadAbha && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Current ABHA Status Card */}
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-500" />
                  ABHA Identity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {abhaLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-1/2" />
                  </div>
                ) : abhaError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    {abhaError}
                  </div>
                ) : abhaDetails ? (
                  <div className="space-y-4">
                    {/* ABHA Number */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">ABHA Number</div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-lg font-black font-mono tracking-widest text-slate-900 dark:text-white">
                          {abhaDetails.abhaNumberMasked || "—"}
                        </span>
                        <Badge
                          tone={
                            abhaDetails.verificationStatus === "verified" ? "teal" :
                            abhaDetails.verificationStatus === "failed"   ? "red"  : "yellow"
                          }
                        >
                          {abhaDetails.verificationStatus.charAt(0).toUpperCase() + abhaDetails.verificationStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    {/* ABHA Address */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">ABHA Address (PHR)</div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {abhaDetails.abhaAddress || <span className="text-slate-400 dark:text-neutral-500">Not provided</span>}
                      </div>
                    </div>

                    {/* Verified At */}
                    {abhaDetails.verifiedAt && (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 dark:border-emerald-900/30 dark:bg-emerald-950/10">
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Verified On</div>
                        <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                          {formatDateTime(abhaDetails.verifiedAt)}
                        </div>
                      </div>
                    )}

                    {/* Linked on */}
                    <div className="text-xs text-slate-400 dark:text-neutral-500">
                      Linked on {formatDateTime(abhaDetails.createdAt)}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-neutral-200/5">
                      {canVerifyAbha && abhaDetails.verificationStatus !== "verified" && (
                        <Button
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl"
                          loading={abhaVerifySubmitting}
                          onClick={async () => {
                            setAbhaVerifySubmitting(true);
                            try {
                              const res = await verifyAbha(viewingPatientId, { verification_status: "verified" });
                              setAbhaDetails(res.abha);
                              toast.success("ABHA marked as verified");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to verify ABHA");
                            } finally {
                              setAbhaVerifySubmitting(false);
                            }
                          }}
                        >
                          Mark as Verified
                        </Button>
                      )}
                      {canUnlinkAbha && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20 rounded-xl"
                          loading={abhaUnlinkSubmitting}
                          onClick={async () => {
                            if (!window.confirm(`Unlink ABHA number ${abhaDetails.abhaNumberMasked} from this patient? This cannot be undone.`)) return;
                            setAbhaUnlinkSubmitting(true);
                            try {
                              await unlinkAbha(viewingPatientId);
                              setAbhaDetails(null);
                              toast.success("ABHA number unlinked successfully");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to unlink ABHA");
                            } finally {
                              setAbhaUnlinkSubmitting(false);
                            }
                          }}
                        >
                          Unlink ABHA
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-200/5">
                      <Shield className="h-7 w-7 text-slate-400 dark:text-neutral-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No ABHA number linked</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Link the patient's Ayushman Bharat Health Account ID using the form.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link ABHA Form — shown only when not yet linked and user has permission */}
            {canLinkAbha && !abhaDetails && !abhaLoading && (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Link ABHA Number</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const raw = abhaLinkForm.abha_number.trim().replace(/[-\s]/g, "");
                      if (!/^\d{14}$/.test(raw)) {
                        toast.error("ABHA number must be exactly 14 digits");
                        return;
                      }
                      setAbhaLinkSubmitting(true);
                      try {
                        const res = await linkAbha(viewingPatientId, {
                          abha_number: raw,
                          abha_address: abhaLinkForm.abha_address.trim() || undefined,
                        });
                        setAbhaDetails(res.abha);
                        setAbhaLinkForm({ abha_number: "", abha_address: "" });
                        toast.success("ABHA number linked successfully");
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to link ABHA number");
                      } finally {
                        setAbhaLinkSubmitting(false);
                      }
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        ABHA Number <span className="text-red-500">*</span>
                      </span>
                      <Input
                        placeholder="e.g. 91234567890123 or 91-2345-6789-0123"
                        value={abhaLinkForm.abha_number}
                        onChange={(e) => setAbhaLinkForm((f) => ({ ...f, abha_number: e.target.value }))}
                        required
                        maxLength={18}
                        className="mt-1 font-mono tracking-wider"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        14-digit national health ID. Hyphens are accepted and will be stripped automatically.
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        ABHA Address (PHR Address)
                      </span>
                      <Input
                        placeholder="e.g. patient.name@abdm"
                        value={abhaLinkForm.abha_address}
                        onChange={(e) => setAbhaLinkForm((f) => ({ ...f, abha_address: e.target.value }))}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        Optional. Personal Health Record address ending with @abdm.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      loading={abhaLinkSubmitting}
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl"
                    >
                      <Shield className="h-4 w-4" /> Link ABHA Number
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Care Context Section — rendered below ABHA tab content when ABHA tab is active */}
        {profileTab === "abha" && canReadCareContext && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {/* Linked Contexts List */}
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-brand-600" />
                  Care Contexts
                  {careContextData?.activeCount > 0 && (
                    <span className="ml-auto rounded-full bg-brand-100 px-2 py-0.5 text-xs font-bold text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                      {careContextData.activeCount} active
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {careContextLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : careContextError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    {careContextError}
                  </div>
                ) : careContextData?.careContexts?.length ? (
                  <div className="space-y-3">
                    {careContextData.careContexts.map((ctx) => (
                      <div
                        key={ctx.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {ctx.displayName}
                            </span>
                            <Badge tone={ctx.status === "active" ? "teal" : "red"}>
                              {ctx.status.charAt(0).toUpperCase() + ctx.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="mt-1 font-mono text-xs text-slate-400 dark:text-neutral-500 truncate">
                            {ctx.careContextReference}
                          </div>
                          <div className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                            Linked: {formatDateTime(ctx.linkedAt)}
                          </div>
                        </div>
                        {canUnlinkCareContext && ctx.status === "active" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20 rounded-xl"
                            loading={careContextUnlinking === ctx.id}
                            onClick={async () => {
                              if (!window.confirm(`Unlink care context "${ctx.displayName}"? This cannot be undone.`)) return;
                              setCareContextUnlinking(ctx.id);
                              try {
                                await unlinkPatientCareContext({ context_id: ctx.id, patient_id: viewingPatientId });
                                const res = await getCareContexts(viewingPatientId);
                                setCareContextData(res);
                                toast.success("Care context unlinked");
                              } catch (err) {
                                toast.error(err.response?.data?.message || "Failed to unlink care context");
                              } finally {
                                setCareContextUnlinking(null);
                              }
                            }}
                          >
                            Unlink
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-200/5">
                      <Activity className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No care contexts linked</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Link a care context to enable ABDM Health Information Exchange.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link Care Context Form */}
            {canLinkCareContext && (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Link Care Context</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const ref = careContextLinkForm.care_context_reference.trim();
                      const name = careContextLinkForm.display_name.trim();
                      if (!ref || !name) {
                        toast.error("Reference and display name are required");
                        return;
                      }
                      if (!/^[A-Za-z0-9_\-:.]+$/.test(ref)) {
                        toast.error("Reference may only contain letters, digits, underscores, hyphens, colons, and dots");
                        return;
                      }
                      setCareContextLinking(true);
                      try {
                        await linkCareContext({
                          patient_id:             viewingPatientId,
                          care_context_reference: ref,
                          display_name:           name,
                          abha_id:                abhaDetails?.id || undefined,
                        });
                        const res = await getCareContexts(viewingPatientId);
                        setCareContextData(res);
                        setCareContextLinkForm({ care_context_reference: "", display_name: "" });
                        toast.success("Care context linked successfully");
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to link care context");
                      } finally {
                        setCareContextLinking(false);
                      }
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Context Reference <span className="text-red-500">*</span>
                      </span>
                      <Input
                        placeholder="e.g. DISCHARGE_2024_01_15_001"
                        value={careContextLinkForm.care_context_reference}
                        onChange={(e) => setCareContextLinkForm((f) => ({ ...f, care_context_reference: e.target.value }))}
                        required
                        maxLength={100}
                        className="mt-1 font-mono text-sm"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        Unique ABDM identifier for this care encounter. Letters, digits, _ - : . only.
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Display Name <span className="text-red-500">*</span>
                      </span>
                      <Input
                        placeholder="e.g. Discharge Summary – Jan 2024"
                        value={careContextLinkForm.display_name}
                        onChange={(e) => setCareContextLinkForm((f) => ({ ...f, display_name: e.target.value }))}
                        required
                        maxLength={200}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        Human-readable name shown in ABDM health apps.
                      </p>
                    </div>

                    {abhaDetails && (
                      <div className="rounded-xl border border-emerald-100 bg-emerald-50/30 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/30 dark:bg-emerald-950/10 dark:text-emerald-400">
                        Will be linked to ABHA: <span className="font-mono font-bold">{abhaDetails.abhaNumberMasked}</span>
                      </div>
                    )}

                    <Button
                      type="submit"
                      loading={careContextLinking}
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl"
                    >
                      <Activity className="h-4 w-4" /> Link Care Context
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ABDM Consent Tab */}
        {profileTab === "consent" && canReadConsent && (
          <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            {/* Consent History Card */}
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-brand-600" />
                  Consent History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {consentLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : consentError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    {consentError}
                  </div>
                ) : consentData?.consents?.length ? (
                  <div className="space-y-3">
                    {consentData.consents.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white capitalize">
                              {c.consentType.replace(/_/g, " ")}
                            </span>
                            <Badge
                              tone={
                                c.status === "granted" && c.isActive ? "teal" :
                                c.status === "revoked"              ? "red"   :
                                c.status === "expired"              ? "yellow" : "neutral"
                              }
                            >
                              {c.isActive ? "Active" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                            </Badge>
                          </div>
                          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-neutral-500">
                            {c.grantedAt  && <span>Granted: {formatDateTime(c.grantedAt)}</span>}
                            {c.revokedAt  && <span>Revoked: {formatDateTime(c.revokedAt)}</span>}
                            {c.expiresAt  && <span>Expires: {formatDateTime(c.expiresAt)}</span>}
                          </div>
                        </div>
                        {canRevokeConsent && c.isActive && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="shrink-0 border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20 rounded-xl"
                            loading={consentRevoking === c.id}
                            onClick={async () => {
                              if (!window.confirm(`Revoke ${c.consentType.replace(/_/g, " ")} consent? This cannot be undone.`)) return;
                              setConsentRevoking(c.id);
                              try {
                                await revokePatientConsent({ consent_id: c.id, patient_id: viewingPatientId });
                                const res = await getPatientConsents(viewingPatientId);
                                setConsentData(res);
                                toast.success("Consent revoked successfully");
                              } catch (err) {
                                toast.error(err.response?.data?.message || "Failed to revoke consent");
                              } finally {
                                setConsentRevoking(null);
                              }
                            }}
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-200/5">
                      <Shield className="h-7 w-7 text-slate-400 dark:text-neutral-500" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No consent records found</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Grant a consent using the form to get started.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Grant Consent Form */}
            {canGrantConsent && (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Grant Consent</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setConsentGranting(true);
                      try {
                        await grantConsent({
                          patient_id:   viewingPatientId,
                          consent_type: consentGrantForm.consent_type,
                          expires_at:   consentGrantForm.expires_at
                            ? new Date(consentGrantForm.expires_at).toISOString()
                            : undefined,
                        });
                        const res = await getPatientConsents(viewingPatientId);
                        setConsentData(res);
                        setConsentGrantForm({ consent_type: "general", expires_at: "" });
                        toast.success("Consent granted successfully");
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to grant consent");
                      } finally {
                        setConsentGranting(false);
                      }
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Consent Type <span className="text-red-500">*</span>
                      </span>
                      <Select
                        value={consentGrantForm.consent_type}
                        onChange={(e) => setConsentGrantForm((f) => ({ ...f, consent_type: e.target.value }))}
                        className="mt-1"
                      >
                        <option value="general">General ABDM Consent</option>
                        <option value="data_access">Data Access</option>
                        <option value="health_record_share">Health Record Share</option>
                        <option value="telemedicine">Telemedicine</option>
                        <option value="research">Research Use</option>
                        <option value="emergency_access">Emergency Access</option>
                      </Select>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Expiry Date <span className="text-slate-400">(optional)</span>
                      </span>
                      <Input
                        type="datetime-local"
                        value={consentGrantForm.expires_at}
                        onChange={(e) => setConsentGrantForm((f) => ({ ...f, expires_at: e.target.value }))}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        Leave blank for indefinite consent.
                      </p>
                    </div>

                    {/* Active consent status chips */}
                    {consentData?.activeSummary && (
                      <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-3 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                          Currently Active
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(consentData.activeSummary).map(([type, active]) => (
                            <span
                              key={type}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                active
                                  ? "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950/30 dark:text-teal-400"
                                  : "bg-slate-100 text-slate-400 border border-slate-200 dark:bg-neutral-200/5 dark:text-neutral-500"
                              }`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-teal-500" : "bg-slate-300"}`} />
                              {type.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <Button
                      type="submit"
                      loading={consentGranting}
                      className="w-full bg-brand-600 hover:bg-brand-700 text-white rounded-xl"
                    >
                      <Shield className="h-4 w-4" /> Grant Consent
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PM-JAY Beneficiary Tab */}
        {profileTab === "pmjay" && canReadPmjay && (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            {/* Current PM-JAY Status */}
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-amber-500" />
                  PM-JAY Beneficiary Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmjayLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-10 w-1/2" />
                  </div>
                ) : pmjayError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    {pmjayError}
                  </div>
                ) : pmjayDetails ? (
                  <div className="space-y-4">
                    {/* PM-JAY ID */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">PM-JAY Beneficiary ID</div>
                      <div className="mt-2 flex items-center gap-3">
                        <span className="text-lg font-black font-mono tracking-widest text-slate-900 dark:text-white">
                          {pmjayDetails.pmjayId}
                        </span>
                        <Badge
                          tone={
                            pmjayDetails.eligibilityStatus === "eligible"   ? "teal"    :
                            pmjayDetails.eligibilityStatus === "ineligible" ? "red"     : "yellow"
                          }
                        >
                          {pmjayDetails.eligibilityStatus.charAt(0).toUpperCase() + pmjayDetails.eligibilityStatus.slice(1)}
                        </Badge>
                      </div>
                    </div>

                    {/* Beneficiary Name */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Beneficiary Name (on card)</div>
                      <div className="mt-2 text-base font-semibold text-slate-900 dark:text-white">{pmjayDetails.beneficiaryName}</div>
                    </div>

                    {/* Verification Status */}
                    <div className="rounded-2xl border border-slate-100 bg-slate-50/30 p-4 dark:border-neutral-200/5 dark:bg-neutral-100/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Verification Status</div>
                      <div className="mt-2 flex items-center gap-2">
                        <Badge
                          tone={
                            pmjayDetails.verificationStatus === "verified" ? "teal" :
                            pmjayDetails.verificationStatus === "failed"   ? "red"  : "yellow"
                          }
                        >
                          {pmjayDetails.verificationStatus.charAt(0).toUpperCase() + pmjayDetails.verificationStatus.slice(1)}
                        </Badge>
                        {pmjayDetails.verifiedAt && (
                          <span className="text-xs text-slate-400 dark:text-neutral-500">
                            on {formatDateTime(pmjayDetails.verifiedAt)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2">
                      {canVerifyPmjay && pmjayDetails.verificationStatus !== "verified" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-950/20 rounded-xl"
                          loading={pmjayVerifySubmitting}
                          onClick={async () => {
                            setPmjayVerifySubmitting(true);
                            try {
                              const res = await verifyPmjay({
                                patient_id:          viewingPatientId,
                                verification_status: "verified",
                                eligibility_status:  "eligible",
                              });
                              setPmjayDetails(res.pmjay);
                              toast.success("PM-JAY marked as verified and eligible");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to verify PM-JAY");
                            } finally {
                              setPmjayVerifySubmitting(false);
                            }
                          }}
                        >
                          Mark as Verified
                        </Button>
                      )}
                      {canVerifyPmjay && pmjayDetails.verificationStatus !== "failed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-950/20 rounded-xl"
                          loading={pmjayVerifySubmitting}
                          onClick={async () => {
                            setPmjayVerifySubmitting(true);
                            try {
                              const res = await verifyPmjay({
                                patient_id:          viewingPatientId,
                                verification_status: "failed",
                                eligibility_status:  "ineligible",
                              });
                              setPmjayDetails(res.pmjay);
                              toast.success("PM-JAY marked as failed");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to update verification");
                            } finally {
                              setPmjayVerifySubmitting(false);
                            }
                          }}
                        >
                          Mark as Failed
                        </Button>
                      )}
                      {canUnlinkPmjay && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-950/20 rounded-xl"
                          loading={pmjayUnlinkSubmitting}
                          onClick={async () => {
                            if (!window.confirm(`Unlink PM-JAY ID ${pmjayDetails.pmjayId}? This cannot be undone.`)) return;
                            setPmjayUnlinkSubmitting(true);
                            try {
                              await unlinkPmjay(viewingPatientId);
                              setPmjayDetails(null);
                              setPmjayLinkForm({ pmjay_id: "", beneficiary_name: "" });
                              toast.success("PM-JAY enrollment unlinked");
                            } catch (err) {
                              toast.error(err.response?.data?.message || "Failed to unlink PM-JAY");
                            } finally {
                              setPmjayUnlinkSubmitting(false);
                            }
                          }}
                        >
                          Unlink PM-JAY
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/20">
                      <Shield className="h-7 w-7 text-amber-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Not enrolled in PM-JAY</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Link the patient's PM-JAY Beneficiary ID to check scheme eligibility.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Link PM-JAY Form */}
            {canLinkPmjay && !pmjayDetails && !pmjayLoading && (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Link PM-JAY</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="space-y-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const id   = pmjayLinkForm.pmjay_id.trim().toUpperCase();
                      const name = pmjayLinkForm.beneficiary_name.trim();
                      if (!/^[A-Z0-9\-]{8,20}$/.test(id)) {
                        toast.error("PM-JAY ID must be 8–20 alphanumeric characters or hyphens");
                        return;
                      }
                      setPmjayLinkSubmitting(true);
                      try {
                        const res = await linkPmjay({
                          patient_id:       viewingPatientId,
                          pmjay_id:         id,
                          beneficiary_name: name,
                        });
                        setPmjayDetails(res.pmjay);
                        setPmjayLinkForm({ pmjay_id: "", beneficiary_name: "" });
                        toast.success("PM-JAY enrollment linked successfully");
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to link PM-JAY");
                      } finally {
                        setPmjayLinkSubmitting(false);
                      }
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        PM-JAY Beneficiary ID <span className="text-red-500">*</span>
                      </span>
                      <Input
                        placeholder="e.g. PMJAY-1234567890"
                        value={pmjayLinkForm.pmjay_id}
                        onChange={(e) => setPmjayLinkForm((f) => ({ ...f, pmjay_id: e.target.value.toUpperCase() }))}
                        required
                        maxLength={20}
                        className="mt-1 font-mono tracking-wider"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        8–20 character government-issued Beneficiary/HH ID. Hyphens allowed.
                      </p>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Beneficiary Name (as on card) <span className="text-red-500">*</span>
                      </span>
                      <Input
                        placeholder="Full name as printed on PM-JAY card"
                        value={pmjayLinkForm.beneficiary_name}
                        onChange={(e) => setPmjayLinkForm((f) => ({ ...f, beneficiary_name: e.target.value }))}
                        required
                        maxLength={200}
                        className="mt-1"
                      />
                      <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">
                        Name may differ from patient's registered name.
                      </p>
                    </div>

                    <Button
                      type="submit"
                      loading={pmjayLinkSubmitting}
                      className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                    >
                      <Shield className="h-4 w-4" /> Link PM-JAY Enrollment
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* PM-JAY Claims Tab */}
        {profileTab === "pmjay-claims" && canReadClaim && (
          <div className="space-y-6">
            {/* Claims History Table */}
            <Card className="rounded-[24px]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-amber-500" />
                  PM-JAY Claim History
                  {pmjayClaimsData?.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      {pmjayClaimsData.length} claim{pmjayClaimsData.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pmjayClaimsLoading ? (
                  <div className="space-y-3 animate-pulse">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-3/4" />
                  </div>
                ) : pmjayClaimsError ? (
                  <div className="rounded-2xl border border-red-100 bg-red-50/30 p-4 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-400">
                    {pmjayClaimsError}
                  </div>
                ) : pmjayClaimsData?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100 dark:border-neutral-200/5">
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Claim No.</th>
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Status</th>
                          <th className="pb-3 text-right text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Amount</th>
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Submitted</th>
                          <th className="pb-3 text-left text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-neutral-200/5">
                        {pmjayClaimsData.map((claim) => (
                          <tr key={claim.id} className="group">
                            <td className="py-3 font-mono text-xs font-bold text-slate-900 dark:text-white">{claim.claimNumber}</td>
                            <td className="py-3">
                              <Badge
                                tone={
                                  claim.status === "PAID"         ? "teal"    :
                                  claim.status === "APPROVED"     ? "teal"    :
                                  claim.status === "REJECTED"     ? "red"     :
                                  claim.status === "UNDER_REVIEW" ? "yellow"  :
                                  claim.status === "SUBMITTED"    ? "blue"    : "neutral"
                                }
                              >
                                {claim.status.replace(/_/g, " ")}
                              </Badge>
                            </td>
                            <td className="py-3 text-right font-semibold text-slate-900 dark:text-white">
                              ₹{claim.claimAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3 text-xs text-slate-400 dark:text-neutral-500">
                              {claim.submittedAt ? formatDateTime(claim.submittedAt) : "—"}
                            </td>
                            <td className="py-3">
                              <div className="flex flex-wrap gap-1">
                                {/* Submit DRAFT */}
                                {canSubmitClaim && claim.status === "DRAFT" && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="border border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/30 dark:text-blue-400 rounded-lg text-xs px-2 py-1"
                                    loading={pmjaySubmitting === claim.id}
                                    onClick={async () => {
                                      setPmjaySubmitting(claim.id);
                                      try {
                                        const res = await submitPmjayClaim(claim.id);
                                        setPmjayClaimsData((prev) => prev.map((c) => c.id === claim.id ? res.claim : c));
                                        toast.success(`Claim ${claim.claimNumber} submitted`);
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || "Failed to submit claim");
                                      } finally {
                                        setPmjaySubmitting(null);
                                      }
                                    }}
                                  >
                                    Submit
                                  </Button>
                                )}
                                {/* Mark Under Review */}
                                {canUpdateClaim && claim.status === "SUBMITTED" && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="border border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/30 dark:text-amber-400 rounded-lg text-xs px-2 py-1"
                                    loading={pmjayStatusUpdating === claim.id}
                                    onClick={async () => {
                                      setPmjayStatusUpdating(claim.id);
                                      try {
                                        const res = await updatePmjayClaimStatus({ claim_id: claim.id, status: "UNDER_REVIEW" });
                                        setPmjayClaimsData((prev) => prev.map((c) => c.id === claim.id ? res.claim : c));
                                        toast.success("Claim moved to Under Review");
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || "Failed to update status");
                                      } finally {
                                        setPmjayStatusUpdating(null);
                                      }
                                    }}
                                  >
                                    Under Review
                                  </Button>
                                )}
                                {/* Approve */}
                                {canUpdateClaim && claim.status === "UNDER_REVIEW" && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="border border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-400 rounded-lg text-xs px-2 py-1"
                                    loading={pmjayStatusUpdating === claim.id}
                                    onClick={async () => {
                                      setPmjayStatusUpdating(claim.id);
                                      try {
                                        const res = await updatePmjayClaimStatus({ claim_id: claim.id, status: "APPROVED" });
                                        setPmjayClaimsData((prev) => prev.map((c) => c.id === claim.id ? res.claim : c));
                                        toast.success("Claim approved");
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || "Failed to approve claim");
                                      } finally {
                                        setPmjayStatusUpdating(null);
                                      }
                                    }}
                                  >
                                    Approve
                                  </Button>
                                )}
                                {/* Mark Paid */}
                                {canUpdateClaim && claim.status === "APPROVED" && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="border border-teal-200 text-teal-700 hover:bg-teal-50 dark:border-teal-900/30 dark:text-teal-400 rounded-lg text-xs px-2 py-1"
                                    loading={pmjayStatusUpdating === claim.id}
                                    onClick={async () => {
                                      setPmjayStatusUpdating(claim.id);
                                      try {
                                        const res = await updatePmjayClaimStatus({ claim_id: claim.id, status: "PAID" });
                                        setPmjayClaimsData((prev) => prev.map((c) => c.id === claim.id ? res.claim : c));
                                        toast.success("Claim marked as paid");
                                      } catch (err) {
                                        toast.error(err.response?.data?.message || "Failed to mark paid");
                                      } finally {
                                        setPmjayStatusUpdating(null);
                                      }
                                    }}
                                  >
                                    Mark Paid
                                  </Button>
                                )}
                                {/* Reject — SUBMITTED or UNDER_REVIEW */}
                                {canUpdateClaim && ["SUBMITTED", "UNDER_REVIEW"].includes(claim.status) && (
                                  <Button
                                    size="xs"
                                    variant="ghost"
                                    className="border border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/30 dark:text-red-400 rounded-lg text-xs px-2 py-1"
                                    onClick={() => setPmjayRejectForm({ claimId: claim.id, reason: "" })}
                                  >
                                    Reject
                                  </Button>
                                )}
                              </div>
                              {/* Rejection reason inline */}
                              {claim.rejectionReason && (
                                <div className="mt-1.5 text-xs text-red-500 dark:text-red-400">
                                  Reason: {claim.rejectionReason}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/20">
                      <FileText className="h-6 w-6 text-amber-400" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No PM-JAY claims yet</p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Create a claim below to start the PM-JAY reimbursement process.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reject Confirmation Inline Form */}
            {pmjayRejectForm.claimId && (
              <Card className="rounded-[24px] border border-red-100 dark:border-red-900/30">
                <CardHeader>
                  <CardTitle className="text-red-600 dark:text-red-400">Reject Claim</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                      Rejection Reason <span className="text-red-500">*</span>
                    </span>
                    <textarea
                      value={pmjayRejectForm.reason}
                      onChange={(e) => setPmjayRejectForm((f) => ({ ...f, reason: e.target.value }))}
                      rows={3}
                      placeholder="Provide reason for rejection (required)…"
                      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        loading={pmjayStatusUpdating === pmjayRejectForm.claimId}
                        className="bg-red-600 hover:bg-red-700 text-white rounded-xl"
                        onClick={async () => {
                          if (!pmjayRejectForm.reason.trim()) {
                            toast.error("Rejection reason is required");
                            return;
                          }
                          setPmjayStatusUpdating(pmjayRejectForm.claimId);
                          try {
                            const res = await updatePmjayClaimStatus({
                              claim_id:         pmjayRejectForm.claimId,
                              status:           "REJECTED",
                              rejection_reason: pmjayRejectForm.reason.trim(),
                            });
                            setPmjayClaimsData((prev) => prev.map((c) => c.id === pmjayRejectForm.claimId ? res.claim : c));
                            setPmjayRejectForm({ claimId: null, reason: "" });
                            toast.success("Claim rejected");
                          } catch (err) {
                            toast.error(err.response?.data?.message || "Failed to reject claim");
                          } finally {
                            setPmjayStatusUpdating(null);
                          }
                        }}
                      >
                        Confirm Rejection
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-xl"
                        onClick={() => setPmjayRejectForm({ claimId: null, reason: "" })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Create New Claim Form */}
            {canCreateClaim && (
              <Card className="rounded-[24px]">
                <CardHeader>
                  <CardTitle>Create PM-JAY Claim</CardTitle>
                </CardHeader>
                <CardContent>
                  <form
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const amount = parseFloat(pmjayCreateForm.claim_amount);
                      if (!amount || amount <= 0) {
                        toast.error("Claim amount must be greater than ₹0");
                        return;
                      }
                      setPmjayCreateSubmitting(true);
                      try {
                        const res = await createPmjayClaim({
                          patient_id:     viewingPatientId,
                          claim_amount:   amount,
                          appointment_id: pmjayCreateForm.appointment_id ? parseInt(pmjayCreateForm.appointment_id, 10) : undefined,
                        });
                        setPmjayClaimsData((prev) => [res.claim, ...(prev || [])]);
                        setPmjayCreateForm({ claim_amount: "", appointment_id: "" });
                        toast.success(`Claim ${res.claim.claimNumber} created (DRAFT)`);
                      } catch (err) {
                        toast.error(err.response?.data?.message || "Failed to create claim");
                      } finally {
                        setPmjayCreateSubmitting(false);
                      }
                    }}
                  >
                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Claim Amount (₹) <span className="text-red-500">*</span>
                      </span>
                      <Input
                        type="number"
                        min="1"
                        step="0.01"
                        placeholder="e.g. 15000.00"
                        value={pmjayCreateForm.claim_amount}
                        onChange={(e) => setPmjayCreateForm((f) => ({ ...f, claim_amount: e.target.value }))}
                        required
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                        Appointment ID <span className="text-slate-400">(optional)</span>
                      </span>
                      <Input
                        type="number"
                        min="1"
                        placeholder="Link to appointment"
                        value={pmjayCreateForm.appointment_id}
                        onChange={(e) => setPmjayCreateForm((f) => ({ ...f, appointment_id: e.target.value }))}
                        className="mt-1"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <Button
                        type="submit"
                        loading={pmjayCreateSubmitting}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl"
                      >
                        <FileText className="h-4 w-4" /> Create Draft Claim
                      </Button>
                    </div>
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-855 bg-slate-50/30 dark:bg-neutral-100/5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emrForm.addAllergy}
                    onChange={(e) => setEmrForm((c) => ({ ...c, addAllergy: e.target.checked }))}
                    className="rounded text-brand-600 focus:ring-brand-500 focus:ring-offset-0 focus:ring-0"
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
                      <Select
                        value={emrForm.allergy_severity}
                        onChange={(e) => setEmrForm((c) => ({ ...c, allergy_severity: e.target.value }))}
                        className="mt-1 bg-white"
                      >
                        <option value="mild">Mild</option>
                        <option value="moderate">Moderate</option>
                        <option value="severe">Severe</option>
                        <option value="anaphylactic">Anaphylactic</option>
                      </Select>
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
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 dark:border-slate-855 bg-slate-50/30 dark:bg-neutral-100/5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={emrForm.addMedication}
                    onChange={(e) => setEmrForm((c) => ({ ...c, addMedication: e.target.checked }))}
                    className="rounded text-brand-600 focus:ring-brand-500 focus:ring-offset-0 focus:ring-0"
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

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-200/5">
              <Button type="button" variant="ghost" onClick={() => setEmrOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={emrSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
                Save Record
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    );
  }

  // Filter Patients on the Client-side
  const filteredPatients = patients.filter(patient => {
    if (filterGender !== "all") {
      const gender = (patient.gender || "").trim().toLowerCase();
      if (gender !== filterGender) return false;
    }
    if (filterBloodGroup !== "all") {
      const blood = (patient.bloodGroup || "").trim().toUpperCase();
      if (blood !== filterBloodGroup.toUpperCase()) return false;
    }
    if (filterStatus !== "all") {
      const status = (patient.status || "").trim().toLowerCase();
      if (status !== filterStatus) return false;
    }
    return true;
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Patient list"
        title="Patients Management"
        description="Search, view profiles, toggle status, and manage EMR records."
        actions={
          isAdminOrStaff && (
            <Button onClick={handleOpenAdd} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl shadow-button-glow">
              <Plus className="h-4 w-4" />
              Add Patient
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="relative w-full sm:max-w-md">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 pr-4"
            placeholder="Search by name, email, or MRN..."
          />
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-36">
            <Select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value)}
            >
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="undisclosed">Undisclosed</option>
            </Select>
          </div>
          
          <div className="w-full sm:w-44">
            <Select
              value={filterBloodGroup}
              onChange={(e) => setFilterBloodGroup(e.target.value)}
            >
              <option value="all">All Blood Groups</option>
              {["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full sm:w-36">
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <PatientsListSkeleton />
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredPatients}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No patients found"
                description="Try adjusting your search criteria, removing filters, or register a new patient."
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
                render: (row) => {
                  const fullName = row.fullName || `${row.first_name} ${row.last_name}`;
                  const initials = getInitials(fullName);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 font-bold text-xs text-brand-600 dark:bg-brand-950/40 dark:text-brand-400">
                        {initials}
                      </div>
                      <div className="font-semibold text-slate-900 dark:text-white">{fullName}</div>
                    </div>
                  );
                }
              },
              {
                key: "gender",
                label: "Gender",
                render: (row) => row.gender ? <span className="capitalize">{row.gender}</span> : "N/A"
              },
              {
                key: "dateOfBirth",
                label: "DOB",
                render: (row) => formatDate(row.dateOfBirth)
              },
              { key: "phone", label: "Phone" },
              { key: "email", label: "Email" },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "active" ? "teal" : "red"}>
                    {row.status === "active" ? "Active" : "Inactive"}
                  </Badge>
                )
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setViewingPatientId(row.patient_id || row.id)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-400 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-all duration-200"
                      title="Open Patient Profile"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {isAdminOrStaff && (
                      <button
                        onClick={() => handleOpenEdit(row)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/50 text-slate-500 hover:border-brand-100 hover:bg-brand-50 hover:text-brand-600 dark:border-neutral-200/5 dark:bg-neutral-100/10 dark:text-slate-400 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 transition-all duration-200"
                        title="Edit Patient"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleToggleStatus(row)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-slate-100 bg-slate-50/55 hover:scale-105 transition-all duration-200 ${
                        row.status === "active" 
                          ? "border-red-100 hover:bg-red-50 text-red-500 hover:text-red-650 dark:border-red-950/20 dark:hover:bg-red-950/30" 
                          : "border-teal-100 hover:bg-teal-50 text-teal-500 hover:text-teal-650 dark:border-teal-950/20 dark:hover:bg-teal-950/30"
                      }`}
                      title={row.status === "active" ? "Deactivate Account" : "Activate Account"}
                    >
                      {row.status === "active" ? (
                        <UserX className="h-4 w-4" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </button>
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
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">First Name *</span>
              <Input
                placeholder="Ramesh"
                value={form.first_name}
                onChange={(e) => handleInputChange("first_name", e.target.value)}
                error={errors.first_name}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-655 dark:text-slate-455">Last Name *</span>
              <Input
                placeholder="Kumar"
                value={form.last_name}
                onChange={(e) => handleInputChange("last_name", e.target.value)}
                error={errors.last_name}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Email *</span>
              <Input
                type="email"
                placeholder="ramesh@gmail.com"
                value={form.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                error={errors.email}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Phone</span>
              <Input
                placeholder="+91 90000 00000"
                value={form.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                error={errors.phone}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Gender</span>
              <Select
                value={form.gender}
                onChange={(e) => handleInputChange("gender", e.target.value)}
                className="mt-1 bg-white"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="undisclosed">Undisclosed</option>
              </Select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Date of Birth</span>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={(e) => handleInputChange("date_of_birth", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Blood Group</span>
              <Input
                placeholder="O+"
                value={form.blood_group}
                onChange={(e) => handleInputChange("blood_group", e.target.value)}
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Address</span>
            <textarea
              value={form.address}
              onChange={(e) => handleInputChange("address", e.target.value)}
              rows={2}
              placeholder="Residential address"
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500 mt-1"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">Emergency Contact Name</span>
              <Input
                placeholder="Sita Kumar"
                value={form.emergency_contact_name}
                onChange={(e) => handleInputChange("emergency_contact_name", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">Emergency Contact Phone</span>
              <Input
                placeholder="+91 90000 11111"
                value={form.emergency_contact_phone}
                onChange={(e) => handleInputChange("emergency_contact_phone", e.target.value)}
                error={errors.emergency_contact_phone}
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">Insurance Provider</span>
              <Input
                placeholder="Star Health"
                value={form.insurance_provider}
                onChange={(e) => handleInputChange("insurance_provider", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-400">Insurance Policy Number</span>
              <Input
                placeholder="POL-12345"
                value={form.insurance_policy_number}
                onChange={(e) => handleInputChange("insurance_policy_number", e.target.value)}
              />
            </label>
          </div>

          {editingId ? (
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-405">Account Status</span>
              <Select
                value={form.status}
                onChange={(e) => handleInputChange("status", e.target.value)}
                className="mt-1 bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </label>
          ) : (
            <label className="block">
              <span className="text-xs font-semibold text-slate-650 dark:text-slate-455">Password</span>
              <Input
                type="password"
                placeholder="Optional (Default: Password@123)"
                value={form.password}
                onChange={(e) => handleInputChange("password", e.target.value)}
              />
            </label>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-neutral-200/5">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              {editingId ? "Save Changes" : "Register Patient"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
