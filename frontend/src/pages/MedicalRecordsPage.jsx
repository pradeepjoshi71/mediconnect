import { AlertTriangle, FileUp, Plus, Search, Stethoscope, Edit2, FileText, Clock, X } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getUser } from "../services/session";
import { listPatients, getPatientSummary } from "../services/patientService";
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
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { Modal } from "../components/ui/Modal";
import { formatDate, formatDateTime, statusTone } from "../utils/formatters";

const TABS = ["records", "diagnoses", "allergies", "files"];

const SEVERITY_TONE = {
  mild: "teal",
  moderate: "yellow",
  severe: "red",
  critical: "red",
  anaphylactic: "red",
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

export default function MedicalRecordsPage() {
  const user = getUser();
  const isPatient = user?.role === "patient";
  const isClinicianOrAdmin = ["doctor", "super_admin", "hospital_admin", "admin"].includes(user?.role);

  const [tab, setTab] = useState("records");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(user?.patientProfileId || null);
  
  // Patient details states
  const [profile, setProfile] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [records, setRecords] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [medications, setMedications] = useState([]);
  const [documents, setDocuments] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // EMR Creation / Edit States
  const [emrOpen, setEmrOpen] = useState(false);
  const [emrEditingId, setEmrEditingId] = useState(null);
  const [emrForm, setEmrForm] = useState(initialRecordForm);
  const [emrSubmitting, setEmrSubmitting] = useState(false);

  // File upload states
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDocType, setUploadDocType] = useState("report");
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const patientId = isPatient ? user.patientProfileId : selectedPatientId;

  // Load patients list for searching (non-patients)
  useEffect(() => {
    if (isPatient) return;
    listPatients(deferredSearch)
      .then((items) => {
        setPatients(items);
        if (!selectedPatientId && items[0]) {
          setSelectedPatientId(items[0].patient_id || items[0].id);
        }
      })
      .catch(() => toast.error("Unable to load patients"));
  }, [deferredSearch]);

  // Load patient clinical profile, history & documents
  const loadPatientData = async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      // 1. Get profile & timeline from patientSummary
      const summary = await getPatientSummary(id);
      setProfile(summary.profile);
      setTimeline(summary.timeline || []);

      // 2. Get records, allergies, medications from the new recordService
      const history = await getMedicalHistory(id);
      setRecords(history.records || []);
      setAllergies(history.allergies || []);
      setMedications(history.medications || []);

      // 3. Get documents from documentService
      setLoadingDocs(true);
      const docs = await listDocuments(id);
      setDocuments(docs || []);
      setLoadingDocs(false);
    } catch (error) {
      toast.error("Unable to load patient health records");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) {
      loadPatientData(patientId);
    }
  }, [patientId]);

  // Form submission for EMR record
  const handleEmrSubmit = async (e) => {
    e.preventDefault();
    if (!emrForm.symptoms || !emrForm.diagnosis || !emrForm.treatment_plan) {
      toast.error("Symptoms, Diagnosis, and Treatment Plan are required");
      return;
    }

    setEmrSubmitting(true);
    try {
      const payload = {
        patient_id: patientId,
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
        toast.success("Medical record added successfully");
      }
      setEmrOpen(false);
      loadPatientData(patientId);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save EMR record");
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

  // Upload report
  const handleUploadDoc = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setUploadingDoc(true);
    try {
      await uploadDocument(patientId, uploadFile, uploadDocType);
      toast.success("Medical report uploaded");
      setUploadFile(null);
      
      // Reload timeline and documents
      loadPatientData(patientId);
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

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Electronic health record"
        title="Electronic Medical Records (EMR)"
        description="Review patient longitudinal timelines, diagnosis histories, active prescriptions, and upload lab reports."
      />

      {/* Patient Search & Dropdown for Staff */}
      {!isPatient && (
        <Card>
          <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11"
                placeholder="Search patients by name, email, or MRN"
              />
            </div>
            <select
              value={selectedPatientId || ""}
              onChange={(e) => setSelectedPatientId(Number(e.target.value))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Select patient</option>
              {patients.map((pat) => (
                <option key={pat.patient_id || pat.id} value={pat.patient_id || pat.id}>
                  {pat.fullName || `${pat.first_name} ${pat.last_name}`} ({pat.medicalRecordNumber})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading patient records...</div>
        </div>
      ) : profile ? (
        <div className="space-y-6">
          {/* Patient Overview Summary */}
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card>
              <CardHeader>
                <CardTitle>Patient profile</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Info label="Name" value={profile.fullName || `${profile.first_name} ${profile.last_name}`} />
                <Info label="MRN" value={profile.medicalRecordNumber} />
                <Info label="DOB" value={formatDate(profile.dateOfBirth)} />
                <Info label="Gender" value={profile.gender ? profile.gender.toUpperCase() : "Not set"} />
                <Info label="Blood Group" value={profile.bloodGroup || "Not set"} />
                <Info label="Insurance Policy Number" value={profile.insurancePolicyNumber || "None documented"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Timeline activities</CardTitle>
              </CardHeader>
              <CardContent className="max-h-[260px] overflow-y-auto space-y-3 pr-2">
                {timeline.length ? (
                  timeline.map((item, idx) => (
                    <div key={idx} className="rounded-3xl border border-slate-100 p-4 dark:border-slate-800">
                      <div className="flex items-center justify-between gap-3">
                        <Badge tone={statusTone(item.status)}>{item.type}</Badge>
                        <div className="text-xs text-slate-400">{formatDateTime(item.occurredAt)}</div>
                      </div>
                      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                        {item.summary || "Clinical update"}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.actor}</div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No clinical events yet" description="Timeline events will populate after appointments and documentation." />
                )}
              </CardContent>
            </Card>
          </div>

          {/* EMR Sub Tabs */}
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  tab === t
                    ? "border-b-2 border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Records Tab */}
          {tab === "records" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Clinical Records History</CardTitle>
                {isClinicianOrAdmin && (
                  <Button size="sm" onClick={handleOpenAddEmr}>
                    <Plus className="h-4 w-4" /> Add Medical Record
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {records.length ? (
                  records.map((record) => (
                    <div key={record.id} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                            Diagnosis: {record.diagnosis}
                          </div>
                          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {record.doctor_name || record.doctorName} • {record.doctor_specialization || record.specialization} • {formatDateTime(record.created_at || record.createdAt)}
                          </div>
                        </div>
                        {isClinicianOrAdmin && (
                          <Button size="sm" variant="ghost" onClick={() => handleOpenEditEmr(record)}>
                            <Edit2 className="h-3.5 w-3.5" /> Edit Record
                          </Button>
                        )}
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Chief Complaint / Symptoms</div>
                          <p className="mt-2 text-sm text-slate-800 dark:text-slate-300">{record.symptoms || record.chief_complaint || "None recorded"}</p>
                        </div>
                        <div className="rounded-2xl bg-slate-50/70 p-4 dark:bg-slate-900/60">
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Treatment Plan</div>
                          <p className="mt-2 text-sm text-slate-800 dark:text-slate-300">{record.treatment_plan || record.clinical_notes || "None recorded"}</p>
                        </div>
                      </div>

                      {record.prescription && (
                        <div className="rounded-2xl bg-brand-50/20 border border-brand-100 p-4 dark:bg-brand-950/10 dark:border-brand-900/30">
                          <div className="text-xs font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">Prescription Info</div>
                          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{record.prescription}</p>
                        </div>
                      )}

                      {record.doctor_notes && (
                        <div>
                          <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Private Clinician Notes</div>
                          <p className="mt-1 text-sm italic text-slate-600 dark:text-slate-400">{record.doctor_notes}</p>
                        </div>
                      )}

                      {record.follow_up_date && (
                        <div className="flex items-center gap-2 text-sm">
                          <Badge tone="yellow">Follow-up date</Badge>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {formatDate(record.follow_up_date)}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <EmptyState title="No medical records yet" description="Consultation notes and EMR entries will appear after clinician documentation." />
                )}
              </CardContent>
            </Card>
          )}

          {/* Diagnoses Tab */}
          {tab === "diagnoses" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Diagnoses Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {records.length ? (
                  records.map((r) => (
                    <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                      <div>
                        <div className="text-base font-black text-slate-900 dark:text-white">{r.diagnosis}</div>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          Encounter Date: {formatDateTime(r.created_at || r.createdAt)} • Documented by: {r.doctor_name || r.doctorName}
                        </p>
                        {r.symptoms && (
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                            Symptoms: {r.symptoms}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <EmptyState title="No diagnoses recorded" description="Diagnoses will appear here after a clinician documents them in medical records." />
                )}
              </CardContent>
            </Card>
          )}

          {/* Allergies Tab */}
          {tab === "allergies" && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" /> Allergies List</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {allergies.length ? (
                    allergies.map((a) => (
                      <div key={a.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-900/60">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{a.allergy_name || a.allergen}</span>
                          <Badge tone={SEVERITY_TONE[a.severity] || "neutral"}>{a.severity}</Badge>
                        </div>
                        {a.notes && (
                          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Notes: {a.notes}</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No allergies recorded" description="Patient allergies will appear here after documentation." />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Medications</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {medications.length ? (
                    medications.map((m) => (
                      <div key={m.id} className="rounded-2xl border border-slate-100 p-4 dark:border-slate-900/60">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white">{m.medication_name}</span>
                          <Badge tone="teal">{m.dosage}</Badge>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          <div>Frequency: {m.frequency}</div>
                          <div>Duration: {m.start_date ? formatDate(m.start_date) : "N/A"} to {m.end_date ? formatDate(m.end_date) : "Ongoing"}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No active medications" description="Patient medication history is empty." />
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Files / Documents Tab */}
          {tab === "files" && (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card>
                <CardHeader><CardTitle>Clinical documents & reports</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {loadingDocs ? (
                    <div className="text-center text-sm text-slate-400 py-6">Loading reports...</div>
                  ) : documents.length ? (
                    documents.map((doc) => (
                      <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-slate-100 p-2 dark:bg-slate-900">
                            <FileText className="h-5 w-5 text-slate-500" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">{doc.file_name}</div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">Category: {doc.document_type} • Uploaded {formatDateTime(doc.uploaded_at)}</div>
                          </div>
                        </div>
                        <button type="button" onClick={() => handleDownloadDoc(doc)} className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                          Download
                        </button>
                      </div>
                    ))
                  ) : (
                    <EmptyState title="No files uploaded" description="Reports, imaging, and clinical attachments will appear here." />
                  )}
                </CardContent>
              </Card>

              {isClinicianOrAdmin && (
                <Card>
                  <CardHeader><CardTitle>Upload clinical report</CardTitle></CardHeader>
                  <CardContent>
                    <form onSubmit={handleUploadDoc} className="space-y-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Report Category</span>
                        <select
                          value={uploadDocType}
                          onChange={(e) => setUploadDocType(e.target.value)}
                          className="mt-1 h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                        >
                          <option value="report">Lab report</option>
                          <option value="prescription">Prescription slip</option>
                          <option value="imaging">Imaging (X-Ray, MRI)</option>
                          <option value="insurance">Insurance claim</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Select File</span>
                        <Input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={(e) => setUploadFile(e.target.files[0])}
                          required
                          className="mt-1"
                        />
                      </div>
                      <Button type="submit" loading={uploadingDoc} className="w-full">
                        <FileUp className="h-4 w-4" />
                        Upload report
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      ) : (
        <EmptyState title="No patient selected" description="Choose a patient to view EMR history and files." />
      )}

      {/* EMR Creation / Edit Modal */}
      <Modal
        open={emrOpen}
        onClose={() => setEmrOpen(false)}
        title={emrEditingId ? "Edit Medical Record" : "Add Medical Record Entry"}
      >
        <form onSubmit={handleEmrSubmit} className="space-y-4">
          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Chief Complaint / Symptoms *</span>
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
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Diagnosis *</span>
            <Input
              placeholder="e.g. Type II Diabetes, Hypertension"
              value={emrForm.diagnosis}
              onChange={(e) => setEmrForm((c) => ({ ...c, diagnosis: e.target.value }))}
              required
            />
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Treatment Plan *</span>
            <textarea
              value={emrForm.treatment_plan}
              onChange={(e) => setEmrForm((c) => ({ ...c, treatment_plan: e.target.value }))}
              rows={3}
              placeholder="Describe clinical recommendations and lifestyle suggestions"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              required
            />
          </div>

          <div>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Prescription</span>
            <textarea
              value={emrForm.prescription}
              onChange={(e) => setEmrForm((c) => ({ ...c, prescription: e.target.value }))}
              rows={2}
              placeholder="e.g. Paracetamol 650mg - 1 daily after food"
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Doctor Private Notes</span>
              <Input
                placeholder="Internal clinician remarks"
                value={emrForm.doctor_notes}
                onChange={(e) => setEmrForm((c) => ({ ...c, doctor_notes: e.target.value }))}
              />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Follow-up Date</span>
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

function Info({ label, value }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/60">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{label}</div>
      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
