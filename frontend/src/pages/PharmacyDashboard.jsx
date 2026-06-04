import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Clock,
  AlertCircle,
  Search,
  Pill,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { getPrescriptions, getMedicines, getDispensed, dispenseMedicine } from "../services/pharmacyService";
import { formatDateTime, formatDate, formatCurrency } from "../utils/formatters";

export default function PharmacyDashboard() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [dispensedHistory, setDispensedHistory] = useState([]);
  const [activeMedicines, setActiveMedicines] = useState([]);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringCount, setExpiringCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING, ALL, HISTORY

  // Dispense modal state
  const [dispenseModalOpen, setDispenseModalOpen] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState(null);
  const [selectedMedicineId, setSelectedMedicineId] = useState("");
  const [dispenseQuantity, setDispenseQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Fetch prescriptions
      const prescs = await getPrescriptions();
      setPrescriptions(prescs);

      // 2. Fetch dispensed history
      const disp = await getDispensed();
      setDispensedHistory(disp);

      // 3. Fetch active medicines for dispensing dropdown
      const meds = await getMedicines({ status: "ACTIVE" });
      setActiveMedicines(meds);

      // 4. Fetch alert counts
      const lowStock = await getMedicines({ alert: "low_stock" });
      setLowStockCount(lowStock.length);

      const expiring = await getMedicines({ alert: "expiring" });
      setExpiringCount(expiring.length);
    } catch (err) {
      toast.error("Failed to load pharmacy dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleOpenDispenseModal = (prescription) => {
    setSelectedPrescription(prescription);
    setSelectedMedicineId("");
    setDispenseQuantity(1);
    setDispenseModalOpen(true);
  };

  const handleDispense = async (e) => {
    e.preventDefault();
    if (!selectedMedicineId) {
      toast.error("Please select a medicine from the inventory");
      return;
    }
    if (Number(dispenseQuantity) <= 0) {
      toast.error("Please specify a valid quantity greater than 0");
      return;
    }

    setSubmitting(true);
    try {
      await dispenseMedicine({
        prescriptionId: selectedPrescription.id,
        medicineId: Number(selectedMedicineId),
        quantity: Number(dispenseQuantity)
      });
      toast.success("Medication dispensed successfully and inventory updated!");
      setDispenseModalOpen(false);
      loadDashboardData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to dispense medication");
    } finally {
      setSubmitting(false);
    }
  };

  // Compute stat counts
  const pendingCount = prescriptions.filter((p) => p.status === "active").length;
  const todayCount = prescriptions.filter((p) => {
    const todayStr = new Date().toDateString();
    return new Date(p.createdAt).toDateString() === todayStr;
  }).length;

  // Filters based on active tab and search
  const filteredPrescriptions = prescriptions.filter((p) => {
    const matchesSearch =
      p.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.patientMRN?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.medicationName?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "PENDING") {
      return p.status === "active";
    }
    return true; // ALL
  });

  const filteredHistory = dispensedHistory.filter((h) => {
    return (
      h.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.patientMRN?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.medicineName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedMedicine = activeMedicines.find((m) => m.id === Number(selectedMedicineId));

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Pharmacy Operations"
        title="Pharmacist Command Center"
        description="Review active patient prescriptions, match and dispense inventory items, and keep track of low stock or expiring medications."
      />

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-teal-50 dark:bg-teal-950 p-3 text-teal-600 dark:text-teal-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{todayCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today's Prescriptions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-3 text-amber-600 dark:text-amber-400">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{pendingCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Pending Prescriptions</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950 p-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{lowStockCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Low Stock Medicines</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-rose-50 dark:bg-rose-950 p-3 text-rose-600 dark:text-rose-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{expiringCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiring Medicines</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "PENDING", label: "Pending Prescriptions" },
          { id: "ALL", label: "All Prescriptions" },
          { id: "HISTORY", label: "Dispensed History" }
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

      {/* Search Bar */}
      <div className="flex max-w-md items-center gap-2">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11"
            placeholder={activeTab === "HISTORY" ? "Search dispensed history..." : "Search prescriptions..."}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading pharmacy data...</div>
        </div>
      ) : activeTab === "HISTORY" ? (
        // Dispensed History Table
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredHistory}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No dispensed medications logged"
                description="Completed dispensing transactions will appear here."
              />
            }
            columns={[
              {
                key: "id",
                label: "Transaction ID",
                render: (row) => <span className="font-mono text-xs font-semibold">TXN-{row.id}</span>
              },
              { key: "patientName", label: "Patient" },
              { key: "patientMRN", label: "MRN" },
              {
                key: "medicineName",
                label: "Dispensed Medication",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.medicineName}</div>
                    <div className="text-xxs font-bold text-brand-600 dark:text-brand-400">{row.medicineCode}</div>
                  </div>
                )
              },
              { key: "quantity", label: "Quantity", render: (row) => `${row.quantity} units` },
              {
                key: "price",
                label: "Total Cost",
                render: (row) => formatCurrency(Number(row.unitPrice) * Number(row.quantity) * 100, "USD")
              },
              { key: "pharmacistName", label: "Dispensed By" },
              { key: "dispensedAt", label: "Dispensed At", render: (row) => formatDateTime(row.dispensedAt) }
            ]}
          />
        </div>
      ) : (
        // Prescriptions List (Pending/All)
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredPrescriptions}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No prescriptions found"
                description="Physician EMR prescriptions will appear here."
              />
            }
            columns={[
              {
                key: "id",
                label: "Prescription ID",
                render: (row) => <span className="font-mono text-xs font-semibold">RX-{row.id}</span>
              },
              { key: "patientName", label: "Patient" },
              { key: "patientMRN", label: "MRN" },
              {
                key: "medicationName",
                label: "Prescribed Item",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.medicationName}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{row.dosage} • {row.frequency}</div>
                  </div>
                )
              },
              { key: "durationDays", label: "Duration", render: (row) => `${row.durationDays} days` },
              { key: "doctorName", label: "Doctor" },
              { key: "createdAt", label: "Prescribed At", render: (row) => formatDateTime(row.createdAt) },
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
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex gap-2">
                    {row.status === "active" ? (
                      <Button size="sm" onClick={() => handleOpenDispenseModal(row)}>
                        <Pill className="h-3.5 w-3.5 mr-1" /> Dispense
                      </Button>
                    ) : (
                      <span className="text-slate-400 text-xs italic flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" /> Completed
                      </span>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Dispense Medication Modal */}
      <Modal
        open={dispenseModalOpen}
        onClose={() => setDispenseModalOpen(false)}
        title={`Dispense Medication: RX-${selectedPrescription?.id}`}
      >
        <form onSubmit={handleDispense} className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Patient</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedPrescription?.patientName} (MRN: {selectedPrescription?.patientMRN})
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Prescribed Drug</div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                {selectedPrescription?.medicationName}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Dosage: {selectedPrescription?.dosage} | Frequency: {selectedPrescription?.frequency} | Duration: {selectedPrescription?.durationDays} days
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Matching Inventory Medicine *
            </label>
            <select
              value={selectedMedicineId}
              onChange={(e) => setSelectedMedicineId(e.target.value)}
              required
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">-- Choose Medicine --</option>
              {activeMedicines.map((med) => (
                <option key={med.id} value={med.id}>
                  {med.medicineName} ({med.medicineCode}) - Stock: {med.stockQuantity} units
                </option>
              ))}
            </select>
          </div>

          {selectedMedicine && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 grid grid-cols-2 gap-3 text-xs bg-slate-50/50 dark:bg-slate-900/30">
              <div>
                <span className="font-semibold text-slate-400">Generic Name:</span>
                <div className="text-slate-700 dark:text-slate-300 font-medium">{selectedMedicine.genericName || "N/A"}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Manufacturer / Batch:</span>
                <div className="text-slate-700 dark:text-slate-300 font-medium">{selectedMedicine.manufacturer || "N/A"} ({selectedMedicine.batchNumber || "N/A"})</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Expiry Date:</span>
                <div className="text-slate-700 dark:text-slate-300 font-medium">{formatDate(selectedMedicine.expiryDate)}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-400">Unit Price:</span>
                <div className="text-slate-700 dark:text-slate-300 font-medium">${selectedMedicine.unitPrice}</div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Dispense Quantity *
            </label>
            <Input
              type="number"
              min="1"
              max={selectedMedicine ? selectedMedicine.stockQuantity : undefined}
              value={dispenseQuantity}
              onChange={(e) => setDispenseQuantity(e.target.value)}
              required
            />
            {selectedMedicine && (
              <div className="mt-1 text-xxs font-semibold text-slate-400 uppercase">
                Stock remaining after dispense: {Number(selectedMedicine.stockQuantity) - Number(dispenseQuantity)} units
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setDispenseModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={submitting}
              className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl"
              disabled={selectedMedicine && Number(selectedMedicine.stockQuantity) < Number(dispenseQuantity)}
            >
              Confirm & Dispense
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
