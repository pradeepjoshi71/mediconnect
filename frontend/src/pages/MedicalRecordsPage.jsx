import { AlertTriangle, FileUp, Plus, Search, Stethoscope, Trash2, X } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getUser } from "../services/session";
import { listPatients, getPatientSummary } from "../services/patientService";
import {
  downloadPrescriptionPdf,
  listMyMedicalRecords,
  listDiagnoses,
  createDiagnosis,
  deleteDiagnosis,
  listAllergies,
  createAllergy,
  deleteAllergy,
} from "../services/medicalRecordService";
import { downloadFile, uploadFile } from "../services/fileService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { formatDate, formatDateTime, statusTone } from "../utils/formatters";

const TABS = ["records", "diagnoses", "allergies", "files"];

const SEVERITY_TONE = {
  mild: "teal",
  moderate: "yellow",
  severe: "red",
  critical: "red",
  anaphylactic: "red",
};

export default function MedicalRecordsPage() {
  const user = getUser();
  const isPatient = user?.role === "patient";
  const isClinicianOrAdmin = ["doctor", "admin"].includes(user?.role);

  const [tab, setTab] = useState("records");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(user?.patientProfileId || null);
  const [summary, setSummary] = useState(null);
  const [mine, setMine] = useState(null);

  const [diagnoses, setDiagnoses] = useState([]);
  const [allergies, setAllergies] = useState([]);

  const [diagnosisForm, setDiagnosisForm] = useState({
    open: false,
    description: "",
    icdCode: "",
    severity: "moderate",
    status: "active",
    notes: "",
    onsetDate: "",
  });

  const [allergyForm, setAllergyForm] = useState({
    open: false,
    allergen: "",
    allergyType: "drug",
    reaction: "",
    severity: "moderate",
    status: "active",
    notes: "",
  });

  const [uploadMeta, setUploadMeta] = useState({ file: null, fileCategory: "lab_report" });

  const patientId = isPatient ? user.patientProfileId : selectedPatientId;

  // load patient list (non-patient roles)
  useEffect(() => {
    if (isPatient) {
      Promise.all([listMyMedicalRecords(), getPatientSummary(user.patientProfileId)])
        .then(([records, summaryData]) => {
          setMine(records);
          setSummary(summaryData);
        })
        .catch(() => toast.error("Unable to load medical records"));
      return;
    }

    listPatients(deferredSearch)
      .then((items) => {
        setPatients(items);
        if (!selectedPatientId && items[0]) setSelectedPatientId(items[0].id);
      })
      .catch(() => toast.error("Unable to load patients"));
  }, [deferredSearch]);

  // load patient summary on selection
  useEffect(() => {
    if (!selectedPatientId || isPatient) return;
    getPatientSummary(selectedPatientId)
      .then(setSummary)
      .catch(() => toast.error("Unable to load patient summary"));
  }, [selectedPatientId]);

  // load diagnoses & allergies when patientId + tab change
  useEffect(() => {
    if (!patientId) return;
    if (tab === "diagnoses") {
      listDiagnoses(patientId).then(setDiagnoses).catch(() => toast.error("Unable to load diagnoses"));
    }
    if (tab === "allergies") {
      listAllergies(patientId).then(setAllergies).catch(() => toast.error("Unable to load allergies"));
    }
  }, [patientId, tab]);

  async function submitUpload() {
    if (!uploadMeta.file || !patientId) return;
    try {
      await uploadFile({ file: uploadMeta.file, patientId, fileCategory: uploadMeta.fileCategory });
      toast.success("Clinical file uploaded");
      setUploadMeta({ file: null, fileCategory: "lab_report" });
      setSummary(await getPatientSummary(patientId));
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to upload file");
    }
  }

  async function submitDiagnosis(event) {
    event.preventDefault();
    try {
      await createDiagnosis(patientId, {
        description: diagnosisForm.description,
        icdCode: diagnosisForm.icdCode || undefined,
        severity: diagnosisForm.severity,
        status: diagnosisForm.status,
        notes: diagnosisForm.notes || undefined,
        onsetDate: diagnosisForm.onsetDate || undefined,
      });
      toast.success("Diagnosis added");
      setDiagnosisForm({ open: false, description: "", icdCode: "", severity: "moderate", status: "active", notes: "", onsetDate: "" });
      const fresh = await listDiagnoses(patientId);
      setDiagnoses(fresh);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add diagnosis");
    }
  }

  async function handleDeleteDiagnosis(id) {
    try {
      await deleteDiagnosis(id);
      setDiagnoses((prev) => prev.filter((d) => d.id !== id));
      toast.success("Diagnosis removed");
    } catch {
      toast.error("Unable to remove diagnosis");
    }
  }

  async function submitAllergy(event) {
    event.preventDefault();
    try {
      await createAllergy(patientId, {
        allergen: allergyForm.allergen,
        allergyType: allergyForm.allergyType,
        reaction: allergyForm.reaction || undefined,
        severity: allergyForm.severity,
        status: allergyForm.status,
        notes: allergyForm.notes || undefined,
      });
      toast.success("Allergy added");
      setAllergyForm({ open: false, allergen: "", allergyType: "drug", reaction: "", severity: "moderate", status: "active", notes: "" });
      const fresh = await listAllergies(patientId);
      setAllergies(fresh);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add allergy");
    }
  }

  async function handleDeleteAllergy(id) {
    try {
      await deleteAllergy(id);
      setAllergies((prev) => prev.filter((a) => a.id !== id));
      toast.success("Allergy removed");
    } catch {
      toast.error("Unable to remove allergy");
    }
  }

  const records = isPatient ? mine?.records || [] : summary?.records || [];
  const files = summary?.files || [];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Electronic health record"
        title="Medical history, prescriptions, and clinical files"
        description="Review the longitudinal patient timeline, diagnoses, doctor notes, prescriptions, and attached reports."
      />

      {!isPatient ? (
        <Card>
          <CardContent className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-11" placeholder="Search patients by name, email, or MRN" />
            </div>
            <select
              value={selectedPatientId || ""}
              onChange={(event) => setSelectedPatientId(Number(event.target.value))}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="">Select patient</option>
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.fullName} ({patient.medicalRecordNumber})
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      ) : null}

      {summary ? (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader><CardTitle>Patient profile</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Info label="Name" value={summary.profile.fullName} />
              <Info label="MRN" value={summary.profile.medicalRecordNumber} />
              <Info label="DOB" value={formatDate(summary.profile.dateOfBirth)} />
              <Info label="Gender" value={summary.profile.gender || "Not set"} />
              <Info label="Allergies" value={summary.profile.allergies || "None documented"} />
              <Info label="Chronic conditions" value={summary.profile.chronicConditions || "None documented"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Patient timeline</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {summary.timeline.length ? (
                summary.timeline.map((item) => (
                  <div key={`${item.type}-${item.entityId}`} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={statusTone(item.status)}>{item.type}</Badge>
                      <div className="text-xs text-slate-500 dark:text-slate-400">{formatDateTime(item.occurredAt)}</div>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{item.summary || "Clinical update"}</div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{item.actor}</div>
                  </div>
                ))
              ) : (
                <EmptyState title="No clinical events yet" description="Timeline events will populate after appointments and documentation." />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <EmptyState title="No patient selected" description="Choose a patient to view records and files." />
      )}

      {/* ─── Tabs ─────────────────────────────────────────────────────────── */}
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

      {/* ─── Records Tab ──────────────────────────────────────────────────── */}
      {tab === "records" && (
        <Card>
          <CardHeader><CardTitle>Clinical records</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {records.length ? (
              records.map((record) => (
                <div key={record.id} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-lg font-black tracking-tight text-slate-950 dark:text-white">{record.diagnosis}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {record.doctorName} • {record.specialization} • {formatDateTime(record.createdAt)}
                      </div>
                    </div>
                    <button type="button" onClick={() => downloadPrescriptionPdf(record.id)} className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                      Download prescription
                    </button>
                  </div>
                  <div className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                    {record.clinicalNotes || record.doctorNotes || "No additional notes were recorded."}
                  </div>
                  {record.prescriptions?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {record.prescriptions.map((item) => (
                        <Badge key={item.id} tone="teal">{item.medicationName} • {item.dosage}</Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <EmptyState title="No medical records yet" description="Consultation notes and prescriptions will appear after visits are documented." />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Diagnoses Tab ────────────────────────────────────────────────── */}
      {tab === "diagnoses" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Stethoscope className="h-4 w-4" /> Diagnoses</CardTitle>
              {isClinicianOrAdmin && !diagnosisForm.open && (
                <Button size="sm" onClick={() => setDiagnosisForm((f) => ({ ...f, open: true }))}>
                  <Plus className="h-4 w-4" /> Add diagnosis
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {diagnosisForm.open && (
              <form onSubmit={submitDiagnosis} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">New diagnosis</div>
                  <button type="button" onClick={() => setDiagnosisForm((f) => ({ ...f, open: false }))}><X className="h-4 w-4 text-slate-400" /></button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Description *</label>
                    <Input required value={diagnosisForm.description} onChange={(e) => setDiagnosisForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Type 2 Diabetes Mellitus" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">ICD Code</label>
                    <Input value={diagnosisForm.icdCode} onChange={(e) => setDiagnosisForm((f) => ({ ...f, icdCode: e.target.value }))} placeholder="e.g. E11.9" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Severity</label>
                    <select value={diagnosisForm.severity} onChange={(e) => setDiagnosisForm((f) => ({ ...f, severity: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                      {["mild", "moderate", "severe", "critical"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Status</label>
                    <select value={diagnosisForm.status} onChange={(e) => setDiagnosisForm((f) => ({ ...f, status: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                      {["active", "resolved", "chronic", "monitoring"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Onset date</label>
                    <Input type="date" value={diagnosisForm.onsetDate} onChange={(e) => setDiagnosisForm((f) => ({ ...f, onsetDate: e.target.value }))} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Notes</label>
                    <Input value={diagnosisForm.notes} onChange={(e) => setDiagnosisForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
                  </div>
                </div>
                <Button type="submit">Save diagnosis</Button>
              </form>
            )}
            {diagnoses.length ? (
              diagnoses.map((d) => (
                <div key={d.id} className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{d.description}</div>
                      {d.icdCode && <Badge tone="neutral">{d.icdCode}</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={SEVERITY_TONE[d.severity] || "neutral"}>{d.severity}</Badge>
                      <Badge tone={d.status === "resolved" ? "teal" : "neutral"}>{d.status}</Badge>
                    </div>
                    <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {d.doctorName} • {formatDate(d.onsetDate)} {d.notes ? `• ${d.notes}` : ""}
                    </div>
                  </div>
                  {isClinicianOrAdmin && (
                    <button type="button" onClick={() => handleDeleteDiagnosis(d.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <EmptyState title="No diagnoses recorded" description="Diagnoses will appear here after a clinician documents them." />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Allergies Tab ────────────────────────────────────────────────── */}
      {tab === "allergies" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Allergies</CardTitle>
              {(isClinicianOrAdmin || user?.role === "receptionist") && !allergyForm.open && (
                <Button size="sm" onClick={() => setAllergyForm((f) => ({ ...f, open: true }))}>
                  <Plus className="h-4 w-4" /> Add allergy
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {allergyForm.open && (
              <form onSubmit={submitAllergy} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">New allergy</div>
                  <button type="button" onClick={() => setAllergyForm((f) => ({ ...f, open: false }))}><X className="h-4 w-4 text-slate-400" /></button>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Allergen *</label>
                    <Input required value={allergyForm.allergen} onChange={(e) => setAllergyForm((f) => ({ ...f, allergen: e.target.value }))} placeholder="e.g. Penicillin" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Type</label>
                    <select value={allergyForm.allergyType} onChange={(e) => setAllergyForm((f) => ({ ...f, allergyType: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                      {["drug", "food", "environmental", "contact", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Reaction</label>
                    <Input value={allergyForm.reaction} onChange={(e) => setAllergyForm((f) => ({ ...f, reaction: e.target.value }))} placeholder="e.g. Anaphylaxis, hives" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Severity</label>
                    <select value={allergyForm.severity} onChange={(e) => setAllergyForm((f) => ({ ...f, severity: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                      {["mild", "moderate", "severe", "anaphylactic"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Status</label>
                    <select value={allergyForm.status} onChange={(e) => setAllergyForm((f) => ({ ...f, status: e.target.value }))} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950">
                      {["active", "inactive", "resolved"].map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">Notes</label>
                    <Input value={allergyForm.notes} onChange={(e) => setAllergyForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Additional notes" />
                  </div>
                </div>
                <Button type="submit">Save allergy</Button>
              </form>
            )}
            {allergies.length ? (
              allergies.map((a) => (
                <div key={a.id} className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-black text-slate-900 dark:text-white">{a.allergen}</div>
                      <Badge tone="neutral">{a.allergyType}</Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={SEVERITY_TONE[a.severity] || "neutral"}>{a.severity}</Badge>
                      <Badge tone={a.status === "resolved" ? "teal" : "neutral"}>{a.status}</Badge>
                    </div>
                    {a.reaction && (
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">Reaction: {a.reaction}</div>
                    )}
                  </div>
                  {isClinicianOrAdmin && (
                    <button type="button" onClick={() => handleDeleteAllergy(a.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <EmptyState title="No allergies recorded" description="Patient allergies will appear here after documentation." />
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Files Tab ────────────────────────────────────────────────────── */}
      {tab === "files" && (
        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle>Clinical files</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {files.length ? (
                files.map((file) => (
                  <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">{file.originalName}</div>
                      <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{file.fileCategory} • {formatDateTime(file.createdAt)}</div>
                    </div>
                    <button type="button" onClick={() => downloadFile(file.id)} className="text-sm font-semibold text-brand-700 dark:text-brand-300">
                      Download
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState title="No files uploaded" description="Reports, imaging, and clinical attachments will appear here." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Upload clinical report</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <select
                value={uploadMeta.fileCategory}
                onChange={(event) => setUploadMeta((current) => ({ ...current, fileCategory: event.target.value }))}
                className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
              >
                <option value="lab_report">Lab report</option>
                <option value="radiology">Radiology</option>
                <option value="clinical_attachment">Clinical attachment</option>
                <option value="other">Other</option>
              </select>
              <Input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(event) => setUploadMeta((current) => ({ ...current, file: event.target.files?.[0] || null }))}
              />
              <Button onClick={submitUpload} disabled={!uploadMeta.file || !patientId}>
                <FileUp className="h-4 w-4" />
                Upload report
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
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
