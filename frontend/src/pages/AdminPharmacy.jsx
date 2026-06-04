import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Search,
  Pill,
  CheckCircle,
  RefreshCw,
  Sliders,
  DollarSign,
  TrendingDown
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent } from "../components/ui/Card";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { getMedicines, createMedicine, updateMedicine, updateStock } from "../services/pharmacyService";
import { formatDate, formatDateTime, formatCurrency } from "../utils/formatters";

const initialMedicineForm = {
  medicineCode: "",
  medicineName: "",
  genericName: "",
  manufacturer: "",
  batchNumber: "",
  expiryDate: "",
  unitPrice: 0,
  stockQuantity: 0,
  reorderLevel: 0,
  status: "ACTIVE"
};

export default function AdminPharmacy() {
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("CATALOG"); // CATALOG, LOW_STOCK, EXPIRING

  // CRUD Modal States
  const [medicineModalOpen, setMedicineModalOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState(null);
  const [medicineForm, setMedicineForm] = useState(initialMedicineForm);
  const [submitting, setSubmitting] = useState(false);

  // Stock Adjustment Modal States
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState(null);
  const [newStockQuantity, setNewStockQuantity] = useState(0);
  const [stockSubmitting, setStockSubmitting] = useState(false);

  async function loadMedicines() {
    setLoading(true);
    try {
      const data = await getMedicines();
      setMedicines(data);
    } catch {
      toast.error("Failed to load medicines inventory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMedicines();
  }, []);

  const handleOpenAddModal = () => {
    setEditingMedicine(null);
    setMedicineForm(initialMedicineForm);
    setMedicineModalOpen(true);
  };

  const handleOpenEditModal = (medicine) => {
    setEditingMedicine(medicine);
    setMedicineForm({
      medicineCode: medicine.medicineCode,
      medicineName: medicine.medicineName,
      genericName: medicine.genericName || "",
      manufacturer: medicine.manufacturer || "",
      batchNumber: medicine.batchNumber || "",
      expiryDate: medicine.expiryDate ? medicine.expiryDate.split("T")[0] : "",
      unitPrice: medicine.unitPrice,
      stockQuantity: medicine.stockQuantity,
      reorderLevel: medicine.reorderLevel,
      status: medicine.status
    });
    setMedicineModalOpen(true);
  };

  const handleOpenStockModal = (medicine) => {
    setSelectedMedicine(medicine);
    setNewStockQuantity(medicine.stockQuantity);
    setStockModalOpen(true);
  };

  const handleSaveMedicine = async (e) => {
    e.preventDefault();
    if (!medicineForm.medicineCode || !medicineForm.medicineName || !medicineForm.expiryDate) {
      toast.error("Code, Name, and Expiry Date are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingMedicine) {
        await updateMedicine(editingMedicine.id, medicineForm);
        toast.success("Medicine details updated successfully!");
      } else {
        await createMedicine(medicineForm);
        toast.success("New medicine added to inventory catalog!");
      }
      setMedicineModalOpen(false);
      loadMedicines();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save medicine");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustStock = async (e) => {
    e.preventDefault();
    if (Number(newStockQuantity) < 0) {
      toast.error("Stock quantity cannot be negative");
      return;
    }

    setStockSubmitting(true);
    try {
      await updateStock(selectedMedicine.id, Number(newStockQuantity));
      toast.success("Stock quantity adjusted successfully!");
      setStockModalOpen(false);
      loadMedicines();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to adjust stock quantity");
    } finally {
      setStockSubmitting(false);
    }
  };

  const handleToggleStatus = async (medicine) => {
    const nextStatus = medicine.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateMedicine(medicine.id, { status: nextStatus });
      toast.success(`Medicine marked ${nextStatus}`);
      loadMedicines();
    } catch (err) {
      toast.error("Failed to update status");
    }
  };

  // Stats Computations
  const totalCount = medicines.length;
  const outOfStockCount = medicines.filter((m) => Number(m.stockQuantity) === 0).length;
  const lowStockCount = medicines.filter((m) => Number(m.stockQuantity) <= Number(m.reorderLevel)).length;
  
  const expiringCount = medicines.filter((m) => {
    const diffTime = new Date(m.expiryDate) - new Date();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 30;
  }).length;

  // Filter medicines based on active tab and search
  const filteredMedicines = medicines.filter((m) => {
    const matchesSearch =
      m.medicineName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.genericName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.medicineCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "LOW_STOCK") {
      return Number(m.stockQuantity) <= Number(m.reorderLevel);
    }
    if (activeTab === "EXPIRING") {
      const diffTime = new Date(m.expiryDate) - new Date();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }
    return true; // CATALOG
  });

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Inventory Controls"
        title="Pharmacy & Medicine Repository"
        description="Oversee hospital medicine master catalogs, generate inventory alerts, review stock updates, and administer pharmacy databases."
      />

      {/* Stats Cards (Overview) */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-teal-50 dark:bg-teal-950 p-3 text-teal-600 dark:text-teal-400">
              <Pill className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{totalCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Cataloged Medicines</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-red-50 dark:bg-red-950 p-3 text-red-600 dark:text-red-400">
              <TrendingDown className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{outOfStockCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Out of Stock</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/60 bg-white/80 dark:border-slate-800 dark:bg-slate-950/70 shadow-soft">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="rounded-2xl bg-amber-50 dark:bg-amber-950 p-3 text-amber-600 dark:text-amber-400">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{lowStockCount}</div>
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Low Stock Alert</div>
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
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Expiring Soon</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "CATALOG", label: "Medicine Catalog" },
          { id: "LOW_STOCK", label: "Low Stock Reports" },
          { id: "EXPIRING", label: "Expiry Reports" }
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

      {/* Control Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full max-w-md items-center gap-2">
          <div className="relative w-full">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11"
              placeholder="Search catalog by name, code, manufacturer..."
            />
          </div>
        </div>

        <Button onClick={handleOpenAddModal}>
          <Plus className="h-4 w-4 mr-1" /> Add New Medicine
        </Button>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading medicine records...</div>
        </div>
      ) : (
        // Inventory Table
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredMedicines}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No medicines cataloged"
                description="Click 'Add New Medicine' to register items in the database."
              />
            }
            columns={[
              {
                key: "code",
                label: "Code",
                render: (row) => <span className="font-mono text-xs font-semibold">{row.medicineCode}</span>
              },
              {
                key: "name",
                label: "Medicine details",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.medicineName}</div>
                    <div className="text-xxs font-bold text-slate-400">{row.genericName || "No generic name documented"}</div>
                  </div>
                )
              },
              { key: "manufacturer", label: "Manufacturer" },
              { key: "batchNumber", label: "Batch/Lot", render: (row) => row.batchNumber || "N/A" },
              {
                key: "unitPrice",
                label: "Unit Price",
                render: (row) => formatCurrency(Number(row.unitPrice) * 100, "USD")
              },
              {
                key: "stockQuantity",
                label: "Available Stock",
                render: (row) => {
                  const isLow = Number(row.stockQuantity) <= Number(row.reorderLevel);
                  const isOut = Number(row.stockQuantity) === 0;
                  return (
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold ${isOut ? "text-red-500" : isLow ? "text-amber-500" : ""}`}>
                        {row.stockQuantity} units
                      </span>
                      {isOut ? (
                        <Badge tone="rose">Out</Badge>
                      ) : isLow ? (
                        <Badge tone="amber">Low</Badge>
                      ) : null}
                    </div>
                  );
                }
              },
              { key: "expiryDate", label: "Expiry Date", render: (row) => formatDate(row.expiryDate) },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "ACTIVE" ? "teal" : "neutral"}>
                    {row.status}
                  </Badge>
                )
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => handleOpenStockModal(row)}>
                      <Sliders className="h-3.5 w-3.5 mr-1 text-slate-500" /> Stock
                    </Button>
                    <Button size="sm" variant="ghost" className="text-brand-600" onClick={() => handleOpenEditModal(row)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={row.status === "ACTIVE" ? "text-amber-600" : "text-emerald-600"}
                      onClick={() => handleToggleStatus(row)}
                    >
                      {row.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* CRUD Add/Edit Medicine Modal */}
      <Modal
        open={medicineModalOpen}
        onClose={() => setMedicineModalOpen(false)}
        title={editingMedicine ? `Edit Medicine details: ${editingMedicine.medicineName}` : "Register New Medicine Catalog"}
      >
        <form onSubmit={handleSaveMedicine} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Medicine Code *
              </label>
              <Input
                placeholder="e.g. ASP-75, MET-500"
                value={medicineForm.medicineCode}
                onChange={(e) => setMedicineForm((c) => ({ ...c, medicineCode: e.target.value }))}
                required
                disabled={!!editingMedicine}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Medicine Name *
              </label>
              <Input
                placeholder="e.g. Aspirin 75mg, Metformin"
                value={medicineForm.medicineName}
                onChange={(e) => setMedicineForm((c) => ({ ...c, medicineName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Generic Formula Name
              </label>
              <Input
                placeholder="e.g. Acetylsalicylic Acid"
                value={medicineForm.genericName}
                onChange={(e) => setMedicineForm((c) => ({ ...c, genericName: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Manufacturer Brand
              </label>
              <Input
                placeholder="e.g. Bayer, Pfizer"
                value={medicineForm.manufacturer}
                onChange={(e) => setMedicineForm((c) => ({ ...c, manufacturer: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Batch/Lot Number
              </label>
              <Input
                placeholder="e.g. BATCH-A1"
                value={medicineForm.batchNumber}
                onChange={(e) => setMedicineForm((c) => ({ ...c, batchNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Expiry Date *
              </label>
              <Input
                type="date"
                value={medicineForm.expiryDate}
                onChange={(e) => setMedicineForm((c) => ({ ...c, expiryDate: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Unit Price ($) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={medicineForm.unitPrice}
                onChange={(e) => setMedicineForm((c) => ({ ...c, unitPrice: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Initial Stock *
              </label>
              <Input
                type="number"
                min="0"
                value={medicineForm.stockQuantity}
                onChange={(e) => setMedicineForm((c) => ({ ...c, stockQuantity: e.target.value }))}
                required
                disabled={!!editingMedicine}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Reorder Threshold *
              </label>
              <Input
                type="number"
                min="0"
                value={medicineForm.reorderLevel}
                onChange={(e) => setMedicineForm((c) => ({ ...c, reorderLevel: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Inventory Status
            </label>
            <select
              value={medicineForm.status}
              onChange={(e) => setMedicineForm((c) => ({ ...c, status: e.target.value }))}
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setMedicineModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl">
              Save Medicine
            </Button>
          </div>
        </form>
      </Modal>

      {/* Stock Adjustment Modal */}
      <Modal
        open={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        title={`Adjust Stock Level: ${selectedMedicine?.medicineName}`}
      >
        <form onSubmit={handleAdjustStock} className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <span className="text-xs text-slate-400 font-bold uppercase">Current Inventory Level</span>
            <div className="text-lg font-black text-slate-900 dark:text-white">
              {selectedMedicine?.stockQuantity} units
            </div>
            <div className="text-xxs text-slate-500 font-semibold uppercase tracking-wider mt-1">
              Reorder level threshold: {selectedMedicine?.reorderLevel} units
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              New Absolute Stock Quantity *
            </label>
            <Input
              type="number"
              min="0"
              value={newStockQuantity}
              onChange={(e) => setNewStockQuantity(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setStockModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={stockSubmitting} className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl">
              Update Stock Quantity
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
