import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Clock,
  CheckCircle,
  FileDown,
  Pill,
  Calendar,
  User,
  Heart
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent } from "../components/ui/Card";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { getPrescriptions, getDispensed } from "../services/pharmacyService";
import { downloadProtectedFile } from "../services/downloadService";
import { formatDateTime, formatDate, formatCurrency } from "../utils/formatters";

export default function PatientPharmacy() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispensedHistory, setDispensedHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("PRESCRIPTIONS"); // PRESCRIPTIONS, HISTORY
  const [downloading, setDownloading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [prescs, disp] = await Promise.all([
        getPrescriptions(),
        getDispensed()
      ]);
      setPrescriptions(prescs);
      setDispensedHistory(disp);
    } catch {
      toast.error("Failed to load medication data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleDownloadHistory = async () => {
    setDownloading(true);
    try {
      await downloadProtectedFile("/pharmacy/dispensed/download", "my-medication-history.csv");
      toast.success("Medication history download started!");
    } catch (err) {
      toast.error("Failed to download medication history");
    } finally {
      setDownloading(false);
    }
  };

  const activeCount = prescriptions.filter(p => p.status === "active").length;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          eyebrow="Patient Care Portal"
          title="My Prescriptions & Medications"
          description="Access doctor prescriptions, review medications dispensed by the pharmacist, and download your medication history."
        />
        <Button onClick={handleDownloadHistory} loading={downloading} className="sm:self-end">
          <FileDown className="h-4 w-4 mr-2" /> Download History
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-3 text-amber-600 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{activeCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Active Prescriptions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-teal-50 dark:bg-teal-950 p-3 text-teal-600 dark:text-teal-400">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                {prescriptions.filter(p => p.status === "completed").length}
              </div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Filled Prescriptions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-brand-50 dark:bg-brand-950 p-3 text-brand-600 dark:text-brand-400">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{dispensedHistory.length}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Dispensed Medications</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "PRESCRIPTIONS", label: "My Prescriptions" },
          { id: "HISTORY", label: "Pharmacy Pickup History" }
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === t.id
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading records...</div>
        </div>
      ) : activeTab === "PRESCRIPTIONS" ? (
        // Prescriptions List
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={prescriptions}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No prescriptions documented"
                description="Prescriptions ordered during your clinical visits will appear here."
              />
            }
            columns={[
              {
                key: "id",
                label: "RX ID",
                render: (row) => <span className="font-mono text-xs font-semibold">RX-{row.id}</span>
              },
              {
                key: "medicationName",
                label: "Medication",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.medicationName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{row.dosage} • {row.frequency}</div>
                  </div>
                )
              },
              { key: "durationDays", label: "Duration", render: (row) => `${row.durationDays} days` },
              { key: "doctorName", label: "Prescribing Doctor", render: (row) => `${row.doctorName} (${row.doctorSpecialization})` },
              { key: "instructions", label: "Instructions", render: (row) => row.instructions || "None" },
              { key: "createdAt", label: "Prescribed Date", render: (row) => formatDate(row.createdAt) },
              {
                key: "status",
                label: "Status",
                render: (row) => {
                  let tone = "neutral";
                  if (row.status === "active") tone = "amber";
                  if (row.status === "completed") tone = "teal";
                  if (row.status === "cancelled") tone = "red";
                  return <Badge tone={tone}>{row.status.toUpperCase()}</Badge>;
                }
              }
            ]}
          />
        </div>
      ) : (
        // Pickup/Dispense History List
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={dispensedHistory}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No pickup history"
                description="Medications dispensed to you by the pharmacist will be listed here."
              />
            }
            columns={[
              {
                key: "id",
                label: "Receipt ID",
                render: (row) => <span className="font-mono text-xs font-semibold">TXN-{row.id}</span>
              },
              {
                key: "medicineName",
                label: "Medicine Dispensed",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.medicineName}</div>
                    <div className="text-xxs font-bold text-slate-400">{row.medicineCode}</div>
                  </div>
                )
              },
              { key: "quantity", label: "Quantity Picked Up", render: (row) => `${row.quantity} units` },
              {
                key: "price",
                label: "Total Cost",
                render: (row) => formatCurrency(Number(row.unitPrice) * Number(row.quantity) * 100, "USD")
              },
              { key: "pharmacistName", label: "Dispensed By (Pharmacist)" },
              { key: "dispensedAt", label: "Pickup Date", render: (row) => formatDateTime(row.dispensedAt) }
            ]}
          />
        </div>
      )}
    </div>
  );
}
