import { FileUp, Search } from "lucide-react";
import { useDeferredValue, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getUser } from "../services/session";
import { listPatients, getPatientSummary } from "../services/patientService";
import { downloadPrescriptionPdf, listMyMedicalRecords } from "../services/medicalRecordService";
import { downloadFile, uploadFile } from "../services/fileService";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { formatDate, formatDateTime, statusTone } from "../utils/formatters";

export default function MedicalRecordsPage() {
  const user = getUser();
  const isPatient = user?.role === "patient";
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(user?.patientProfileId || null);
  const [summary, setSummary] = useState(null);
  const [mine, setMine] = useState(null);
  const [uploadMeta, setUploadMeta] = useState({
    file: null,
    fileCategory: "lab_report",
  });

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
        if (!selectedPatientId && items[0]) {
          setSelectedPatientId(items[0].id);
        }
      })
      .catch(() => toast.error("Unable to load patients"));
  }, [deferredSearch]);

  useEffect(() => {
    if (!selectedPatientId) return;
    getPatientSummary(selectedPatientId)
      .then(setSummary)
      .catch(() => toast.error("Unable to load patient summary"));
  }, [selectedPatientId]);

  async function submitUpload() {
    if (!uploadMeta.file || !selectedPatientId) return;

    try {
      await uploadFile({
        file: uploadMeta.file,
        patientId: selectedPatientId,
        fileCategory: uploadMeta.fileCategory,
      });
      toast.success("Clinical file uploaded");
      setUploadMeta({ file: null, fileCategory: "lab_report" });
      setSummary(await getPatientSummary(selectedPatientId));
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to upload file");
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
            <CardHeader>
              <CardTitle>Patient profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Info label="Name" value={summary.profile.fullName} />
              <Info label="MRN" value={summary.profile.medicalRecordNumber} />
              <Info label="DOB" value={formatDate(summary.profile.dateOfBirth)} />
              <Info label="Gender" value={summary.profile.gender || "Not set"} />
              <Info label="Allergies" value={summary.profile.allergies || "None documented"} />
              <Info
                label="Chronic conditions"
                value={summary.profile.chronicConditions || "None documented"}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Patient timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.timeline.length ? (
                summary.timeline.map((item) => (
                  <div key={`${item.type}-${item.entityId}`} className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                    <div className="flex items-center justify-between gap-3">
                      <Badge tone={statusTone(item.status)}>{item.type}</Badge>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDateTime(item.occurredAt)}
                      </div>
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                      {item.summary || "Clinical update"}
                    </div>
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

      <Card>
        <CardHeader>
          <CardTitle>Clinical records</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {records.length ? (
            records.map((record) => (
              <div key={record.id} className="rounded-3xl border border-slate-200 p-5 dark:border-slate-800">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-lg font-black tracking-tight text-slate-950 dark:text-white">
                      {record.diagnosis}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {record.doctorName} • {record.specialization} • {formatDateTime(record.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadPrescriptionPdf(record.id)}
                    className="text-sm font-semibold text-brand-700 dark:text-brand-300"
                  >
                    Download prescription
                  </button>
                </div>
                <div className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-400">
                  {record.clinicalNotes || record.doctorNotes || "No additional notes were recorded."}
                </div>
                {record.prescriptions?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {record.prescriptions.map((item) => (
                      <Badge key={item.id} tone="teal">
                        {item.medicationName} • {item.dosage}
                      </Badge>
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

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Clinical files</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.length ? (
              files.map((file) => (
                <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                  <div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {file.originalName}
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {file.fileCategory} • {formatDateTime(file.createdAt)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadFile(file.id)}
                    className="text-sm font-semibold text-brand-700 dark:text-brand-300"
                  >
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
          <CardHeader>
            <CardTitle>Upload clinical report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <select
              value={uploadMeta.fileCategory}
              onChange={(event) =>
                setUploadMeta((current) => ({ ...current, fileCategory: event.target.value }))
              }
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
              onChange={(event) =>
                setUploadMeta((current) => ({ ...current, file: event.target.files?.[0] || null }))
              }
            />
            <Button onClick={submitUpload} disabled={!uploadMeta.file || !selectedPatientId}>
              <FileUp className="h-4 w-4" />
              Upload report
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-4 dark:bg-slate-900/60">
      <div className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">{value}</div>
    </div>
  );
}
