import { useState, useEffect } from "react";
import { 
  Package, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  AlertTriangle, 
  Calendar, 
  Download, 
  Loader2, 
  TrendingUp, 
  Layers, 
  User, 
  Briefcase,
  ArrowUpDown,
  RefreshCw,
  FileText
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import toast from "react-hot-toast";
import {
  listItems,
  createItem,
  updateItem,
  deleteItem,
  createTransaction,
  getReports
} from "../services/inventoryService";

const CATEGORIES = ['Medicine', 'Consumable', 'Equipment', 'Other'];
const UNITS = ['Box', 'Tablet', 'Piece', 'Vial', 'Bottle', 'Pack'];
const TRANSACTION_TYPES = ['Stock In', 'Stock Out', 'Adjustment', 'Transfer'];

export default function InventoryDashboard() {
  const [activeTab, setActiveTab] = useState("catalog");
  
  // State
  const [items, setItems] = useState([]);
  const [reportsData, setReportsData] = useState(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingReports, setLoadingReports] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [lowStockFilter, setLowStockFilter] = useState(false);

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemModalMode, setItemModalMode] = useState("create"); // 'create' or 'edit'
  const [currentItem, setCurrentItem] = useState(null);
  
  const [showTxModal, setShowTxModal] = useState(false);
  const [currentTxItem, setCurrentTxItem] = useState(null);

  // Item Form Data
  const [itemForm, setItemForm] = useState({
    itemName: "",
    sku: "",
    category: "Medicine",
    unit: "Tablet",
    currentStock: "0",
    minimumStock: "0",
    expiryDate: "",
    vendor: "",
  });

  // Transaction Form Data
  const [txForm, setTxForm] = useState({
    transactionType: "Stock In",
    quantity: "",
    notes: "",
  });

  // Load catalog items
  const loadItems = async () => {
    setLoadingItems(true);
    try {
      const filters = {};
      if (search) filters.search = search;
      if (categoryFilter) filters.category = categoryFilter;
      if (lowStockFilter) filters.lowStock = true;
      
      const data = await listItems(filters);
      setItems(data);
    } catch (err) {
      toast.error("Failed to load inventory catalog");
    } finally {
      setLoadingItems(false);
    }
  };

  // Load Reports
  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const data = await getReports();
      setReportsData(data);
    } catch (err) {
      toast.error("Failed to load inventory reports");
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    if (activeTab === "catalog") {
      loadItems();
    } else if (activeTab === "reports") {
      loadReports();
    }
  }, [activeTab, categoryFilter, lowStockFilter]);

  // Handle Search input keypress/button
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadItems();
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setCategoryFilter("");
    setLowStockFilter(false);
    setTimeout(() => {
      loadItems();
    }, 0);
  };

  // Open Item Create Modal
  const handleOpenItemCreate = () => {
    setItemModalMode("create");
    setCurrentItem(null);
    setItemForm({
      itemName: "",
      sku: "",
      category: "Medicine",
      unit: "Tablet",
      currentStock: "0",
      minimumStock: "0",
      expiryDate: "",
      vendor: "",
    });
    setShowItemModal(true);
  };

  // Open Item Edit Modal
  const handleOpenItemEdit = (item) => {
    setItemModalMode("edit");
    setCurrentItem(item);
    setItemForm({
      itemName: item.itemName,
      sku: item.sku,
      category: item.category,
      unit: item.unit,
      currentStock: item.currentStock.toString(),
      minimumStock: item.minimumStock.toString(),
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : "",
      vendor: item.vendor || "",
    });
    setShowItemModal(true);
  };

  // Submit Item Form
  const handleSubmitItem = async (e) => {
    e.preventDefault();
    if (!itemForm.itemName || !itemForm.sku || !itemForm.category || !itemForm.unit) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const payload = {
        itemName: itemForm.itemName,
        sku: itemForm.sku,
        category: itemForm.category,
        unit: itemForm.unit,
        currentStock: parseInt(itemForm.currentStock),
        minimumStock: parseInt(itemForm.minimumStock),
        expiryDate: itemForm.expiryDate || null,
        vendor: itemForm.vendor || null,
      };

      if (itemModalMode === "create") {
        await createItem(payload);
        toast.success("Inventory item added successfully");
      } else {
        await updateItem(currentItem.id, payload);
        toast.success("Inventory item updated successfully");
      }
      setShowItemModal(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save inventory item");
    }
  };

  // Delete Item
  const handleDeleteItem = async (id) => {
    if (!window.confirm("Are you sure you want to delete this inventory item?")) return;
    try {
      await deleteItem(id);
      toast.success("Inventory item deleted");
      loadItems();
    } catch (err) {
      toast.error("Failed to delete inventory item");
    }
  };

  // Open Transaction Modal
  const handleOpenTx = (item) => {
    setCurrentTxItem(item);
    setTxForm({
      transactionType: "Stock In",
      quantity: "",
      notes: "",
    });
    setShowTxModal(true);
  };

  // Submit Transaction
  const handleSubmitTx = async (e) => {
    e.preventDefault();
    if (!txForm.quantity) {
      toast.error("Please enter quantity");
      return;
    }

    try {
      await createTransaction({
        inventoryItemId: currentTxItem.id,
        transactionType: txForm.transactionType,
        quantity: parseInt(txForm.quantity),
        notes: txForm.notes,
      });
      toast.success("Stock transaction logged successfully");
      setShowTxModal(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to log stock transaction");
    }
  };

  // Export Summary Report
  const handleExportReports = () => {
    if (!reportsData) return;
    const headers = ["Item Name", "SKU", "Category", "Unit", "Current Stock", "Min Stock", "Expiry Date", "Vendor"];
    const rows = (reportsData.stockSummary || []).map(item => [
      item.itemName,
      item.sku,
      item.category,
      item.unit,
      item.currentStock,
      item.minimumStock,
      item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A',
      item.vendor || 'N/A'
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "inventory_stock_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventory report exported successfully");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clinic Operations"
        title="Inventory Control Panel"
        description="Monitor medicine stocks, log adjustment transactions, and track expiring clinical inventory."
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "catalog"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Items Catalog
        </button>
        <button
          onClick={() => setActiveTab("reports")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "reports"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Reports & Warnings
        </button>
      </div>

      {/* CATALOG TAB */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200/50 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-1 max-w-md">
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, SKU, vendor..."
              />
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  options={[
                    { value: "", label: "All Categories" },
                    ...CATEGORIES.map(c => ({ value: c, label: c }))
                  ]}
                />
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={lowStockFilter}
                  onChange={(e) => setLowStockFilter(e.target.checked)}
                  className="rounded border-slate-300 text-brand-600 focus:ring-brand-500 h-4 w-4"
                />
                Low Stock
              </label>
              {(search || categoryFilter || lowStockFilter) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Reset
                </button>
              )}
              <Button variant="primary" onClick={handleOpenItemCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>

          {/* List Table */}
          {loadingItems ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
              <PaginatedTable
                rows={items.map(item => {
                  const isLow = item.currentStock <= item.minimumStock;
                  const isExpired = item.expiryDate && new Date(item.expiryDate) <= new Date();
                  
                  return {
                    ...item,
                    stockDisplay: (
                      <div className="flex items-center gap-2">
                        <span className={`font-bold ${isLow ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>
                          {item.currentStock} {item.unit}
                        </span>
                        {isLow && (
                          <Badge variant="danger">Low Stock</Badge>
                        )}
                      </div>
                    ),
                    expiryDisplay: item.expiryDate ? (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span className={isExpired ? 'text-rose-600 font-semibold' : 'text-slate-700 dark:text-slate-300'}>
                          {new Date(item.expiryDate).toLocaleDateString()}
                        </span>
                        {isExpired && <Badge variant="danger">Expired</Badge>}
                      </div>
                    ) : (
                      <span className="text-slate-400">N/A</span>
                    ),
                    actions: (
                      <div className="flex gap-2 justify-end">
                        <Button variant="secondary" size="sm" onClick={() => handleOpenTx(item)}>
                          <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" />
                          Transact
                        </Button>
                        <button
                          onClick={() => handleOpenItemEdit(item)}
                          className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  };
                })}
                pageSize={10}
                columns={[
                  { key: "itemName", label: "Item Name" },
                  { key: "sku", label: "SKU / Code" },
                  { key: "category", label: "Category" },
                  { key: "stockDisplay", label: "Current Level" },
                  { key: "expiryDisplay", label: "Expiry Date" },
                  { key: "vendor", label: "Vendor" },
                  { key: "actions", label: "" }
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <div className="space-y-8">
          {loadingReports ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              {/* Report Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={Package}
                  label="Total Items Listed"
                  value={reportsData?.stockSummary?.length || 0}
                  helper="Unique items tracked"
                  accent="brand"
                />
                <StatCard
                  icon={AlertTriangle}
                  label="Low Stock Items"
                  value={reportsData?.lowStock?.length || 0}
                  helper="Reorder levels breached"
                  accent="danger"
                />
                <StatCard
                  icon={Calendar}
                  label="Expiring (60 Days)"
                  value={reportsData?.expiringInventory?.length || 0}
                  helper="Items near expiration"
                  accent="amber"
                />
              </div>

              {/* Grid Warning details */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Low Stock details */}
                <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                  <h3 className="mb-4 text-base font-bold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="h-5 w-5" />
                    Low Stock List
                  </h3>
                  <PaginatedTable
                    rows={(reportsData?.lowStock || []).map(r => ({
                      ...r,
                      stockLevel: `${r.currentStock} / ${r.minimumStock} ${r.unit}`
                    }))}
                    pageSize={5}
                    columns={[
                      { key: "itemName", label: "Item" },
                      { key: "sku", label: "SKU" },
                      { key: "stockLevel", label: "Stock / Min" },
                      { key: "vendor", label: "Vendor" }
                    ]}
                  />
                </div>

                {/* Expiration warning details */}
                <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                  <h3 className="mb-4 text-base font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
                    <Calendar className="h-5 w-5" />
                    Expiring Inventory Warnings
                  </h3>
                  <PaginatedTable
                    rows={(reportsData?.expiringInventory || []).map(r => {
                      let tag = <Badge variant="success">60 Days Left</Badge>;
                      if (r.status === 'expired') {
                        tag = <Badge variant="danger">Expired</Badge>;
                      } else if (r.status === '30_days_warning') {
                        tag = <Badge variant="danger">30 Days Left</Badge>;
                      }

                      return {
                        ...r,
                        formattedExpiry: new Date(r.expiryDate).toLocaleDateString(),
                        badge: tag
                      };
                    })}
                    pageSize={5}
                    columns={[
                      { key: "itemName", label: "Item" },
                      { key: "formattedExpiry", label: "Expiry Date" },
                      { key: "currentStock", label: "Qty" },
                      { key: "badge", label: "Warning Status" }
                    ]}
                  />
                </div>
              </div>

              {/* print / export statement summary */}
              <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-brand-500" />
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      Full Stock Inventory Sheet
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="secondary" onClick={handleExportReports}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                    <Button variant="secondary" onClick={() => window.print()}>
                      Print Catalog
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ADD/EDIT ITEM MODAL */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-4">
              {itemModalMode === "create" ? "Add Inventory Item" : "Edit Inventory Item"}
            </h3>
            <form onSubmit={handleSubmitItem} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Item Name *
                </label>
                <Input
                  type="text"
                  required
                  value={itemForm.itemName}
                  onChange={(e) => setItemForm({ ...itemForm, itemName: e.target.value })}
                  placeholder="e.g. Paracetamol 650mg, Latex Gloves"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    SKU / Unique Code *
                  </label>
                  <Input
                    type="text"
                    required
                    value={itemForm.sku}
                    onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })}
                    placeholder="e.g. PCM-650"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Category *
                  </label>
                  <Select
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    options={CATEGORIES.map(c => ({ value: c, label: c }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Unit *
                  </label>
                  <Select
                    value={itemForm.unit}
                    onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })}
                    options={UNITS.map(u => ({ value: u, label: u }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Current Stock
                  </label>
                  <Input
                    type="number"
                    min="0"
                    disabled={itemModalMode === "edit"}
                    value={itemForm.currentStock}
                    onChange={(e) => setItemForm({ ...itemForm, currentStock: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    Min Alert Stock
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={itemForm.minimumStock}
                    onChange={(e) => setItemForm({ ...itemForm, minimumStock: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Expiry Date
                </label>
                <Input
                  type="date"
                  value={itemForm.expiryDate}
                  onChange={(e) => setItemForm({ ...itemForm, expiryDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Vendor / Supplier
                </label>
                <Input
                  type="text"
                  value={itemForm.vendor}
                  onChange={(e) => setItemForm({ ...itemForm, vendor: e.target.value })}
                  placeholder="e.g. Pfizer Inc., General Diagnostics"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowItemModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  {itemModalMode === "create" ? "Add Item" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TRANSACTION MODAL */}
      {showTxModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-2">
              Log Inventory Transaction
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Item: <span className="font-bold text-slate-900 dark:text-white">{currentTxItem?.itemName} ({currentTxItem?.sku})</span>
              <br />
              Current Stock: <span className="font-bold text-slate-900 dark:text-white">{currentTxItem?.currentStock} {currentTxItem?.unit}</span>
            </p>
            <form onSubmit={handleSubmitTx} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Transaction Type *
                </label>
                <Select
                  value={txForm.transactionType}
                  onChange={(e) => setTxForm({ ...txForm, transactionType: e.target.value })}
                  options={TRANSACTION_TYPES.map(t => ({ value: t, label: t }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Quantity *
                </label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={txForm.quantity}
                  onChange={(e) => setTxForm({ ...txForm, quantity: e.target.value })}
                  placeholder="Enter positive integer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Reason / Notes / Reference
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/50 dark:text-white"
                  rows="3"
                  value={txForm.notes}
                  onChange={(e) => setTxForm({ ...txForm, notes: e.target.value })}
                  placeholder="Reference invoice number, shelf location transfer details..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowTxModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Execute Transaction
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
