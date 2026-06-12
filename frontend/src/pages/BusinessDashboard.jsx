import { useState, useEffect } from "react";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Plus, 
  Edit, 
  Trash2, 
  Filter, 
  Download, 
  Calendar, 
  Loader2, 
  Briefcase,
  User,
  Layers,
  FileText
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { ChartContainer } from "../components/ui/ChartContainer";
import { TrendBars } from "../components/ui/TrendBars";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { formatCurrency } from "../utils/formatters";
import toast from "react-hot-toast";
import {
  getRevenueDashboard,
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getProfitLoss
} from "../services/businessService";

const EXPENSE_CATEGORIES = ['Rent', 'Electricity', 'Internet', 'Salary', 'Equipment', 'Miscellaneous'];

export default function BusinessDashboard() {
  const [activeTab, setActiveTab] = useState("revenue");
  
  // State variables
  const [revenueData, setRevenueData] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [profitLossData, setProfitLossData] = useState(null);
  
  const [loadingRevenue, setLoadingRevenue] = useState(true);
  const [loadingExpenses, setLoadingExpenses] = useState(true);
  const [loadingPL, setLoadingPL] = useState(true);

  // Expense filters
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [currentExpense, setCurrentExpense] = useState(null);
  const [formData, setFormData] = useState({
    category: "Rent",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().slice(0, 10),
  });

  // Fetch Revenue Dashboard data
  const loadRevenue = async () => {
    setLoadingRevenue(true);
    try {
      const data = await getRevenueDashboard();
      setRevenueData(data);
    } catch (err) {
      toast.error("Failed to load revenue data");
    } finally {
      setLoadingRevenue(false);
    }
  };

  // Fetch Expenses
  const loadExpenses = async () => {
    setLoadingExpenses(true);
    try {
      const filters = {};
      if (filterCategory) filters.category = filterCategory;
      if (filterStartDate) filters.startDate = filterStartDate;
      if (filterEndDate) filters.endDate = filterEndDate;
      
      const data = await listExpenses(filters);
      setExpenses(data);
    } catch (err) {
      toast.error("Failed to load expenses");
    } finally {
      setLoadingExpenses(false);
    }
  };

  // Fetch Profit & Loss data
  const loadProfitLoss = async () => {
    setLoadingPL(true);
    try {
      const data = await getProfitLoss();
      setProfitLossData(data);
    } catch (err) {
      toast.error("Failed to load Profit & Loss data");
    } finally {
      setLoadingPL(false);
    }
  };

  useEffect(() => {
    if (activeTab === "revenue") {
      loadRevenue();
    } else if (activeTab === "expenses") {
      loadExpenses();
    } else if (activeTab === "profit_loss") {
      loadProfitLoss();
    }
  }, [activeTab]);

  // Open modal for Create
  const handleOpenCreate = () => {
    setModalMode("create");
    setCurrentExpense(null);
    setFormData({
      category: "Rent",
      amount: "",
      description: "",
      expenseDate: new Date().toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  // Open modal for Edit
  const handleOpenEdit = (expense) => {
    setModalMode("edit");
    setCurrentExpense(expense);
    setFormData({
      category: expense.category,
      amount: expense.amount,
      description: expense.description || "",
      expenseDate: new Date(expense.expenseDate).toISOString().slice(0, 10),
    });
    setShowModal(true);
  };

  // Submit Expense Form
  const handleSubmitExpense = async (e) => {
    e.preventDefault();
    if (!formData.category || !formData.amount) {
      toast.error("Please fill in category and amount");
      return;
    }

    try {
      const payload = {
        category: formData.category,
        amount: parseFloat(formData.amount),
        description: formData.description,
        expenseDate: formData.expenseDate,
      };

      if (modalMode === "create") {
        await createExpense(payload);
        toast.success("Expense logged successfully");
      } else {
        await updateExpense(currentExpense.id, payload);
        toast.success("Expense updated successfully");
      }
      setShowModal(false);
      loadExpenses();
    } catch (err) {
      toast.error("Failed to save expense details");
    }
  };

  // Delete Expense
  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      await deleteExpense(id);
      toast.success("Expense record deleted");
      loadExpenses();
    } catch (err) {
      toast.error("Failed to delete expense record");
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setFilterCategory("");
    setFilterStartDate("");
    setFilterEndDate("");
    // We load expenses immediately after resetting state (cannot wait for state update to trigger loadExpenses in useEffect because filters haven't updated in that cycle)
    setTimeout(() => {
      loadExpenses();
    }, 0);
  };

  // Export summary as CSV
  const handleExportPL = () => {
    if (!profitLossData) return;
    const headers = ["Month", "Revenue", "Expenses", "Net Profit"];
    const rows = (profitLossData.monthlyTrends || []).map(t => [
      t.label,
      t.revenue,
      t.expenses,
      t.profit
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
      
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "profit_loss_summary.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Financial summary exported successfully");
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Business Operations"
        title="Clinic Finance Console"
        description="Monitor clinic revenue, manage operational expenditures, and review monthly profit & loss trends."
      />

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("revenue")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "revenue"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Revenue Console
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "expenses"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Expense Log Book
        </button>
        <button
          onClick={() => setActiveTab("profit_loss")}
          className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "profit_loss"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          Profit & Loss Statement
        </button>
      </div>

      {/* TAB CONTENT: REVENUE */}
      {activeTab === "revenue" && (
        <div className="space-y-8">
          {loadingRevenue ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              {/* StatCards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <StatCard
                  icon={DollarSign}
                  label="Daily Revenue"
                  value={formatCurrency(revenueData?.summary?.dailyRevenue || 0)}
                  helper="Today's collections"
                  accent="brand"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Weekly Revenue"
                  value={formatCurrency(revenueData?.summary?.weeklyRevenue || 0)}
                  helper="Last 7 days"
                  accent="teal"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Monthly Revenue"
                  value={formatCurrency(revenueData?.summary?.monthlyRevenue || 0)}
                  helper="Last 30 days"
                  accent="success"
                />
                <StatCard
                  icon={TrendingUp}
                  label="Yearly Revenue"
                  value={formatCurrency(revenueData?.summary?.yearlyRevenue || 0)}
                  helper="Last 365 days"
                  accent="amber"
                />
                <StatCard
                  icon={DollarSign}
                  label="Pending Payments"
                  value={formatCurrency(revenueData?.summary?.pendingPayments || 0)}
                  helper="Outstanding invoices"
                  accent="danger"
                />
              </div>

              {/* Grid breakdowns */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Revenue by Doctor */}
                <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                  <h3 className="mb-4 text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <User className="h-5 w-5 text-brand-500" />
                    Revenue by Clinician
                  </h3>
                  <PaginatedTable
                    rows={(revenueData?.revenueByDoctor || []).map(r => ({
                      ...r,
                      formattedAmount: formatCurrency(r.amount)
                    }))}
                    pageSize={5}
                    columns={[
                      { key: "doctorName", label: "Doctor" },
                      { key: "specialization", label: "Specialty" },
                      { key: "formattedAmount", label: "Revenue" }
                    ]}
                  />
                </div>

                {/* Revenue by Service */}
                <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                  <h3 className="mb-4 text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <Layers className="h-5 w-5 text-tealish-500" />
                    Revenue by Service Type
                  </h3>
                  <PaginatedTable
                    rows={(revenueData?.revenueByService || []).map(r => ({
                      service: r.serviceType.toUpperCase(),
                      formattedAmount: formatCurrency(r.amount)
                    }))}
                    pageSize={5}
                    columns={[
                      { key: "service", label: "Service/Item Category" },
                      { key: "formattedAmount", label: "Total Revenue" }
                    ]}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB CONTENT: EXPENSES */}
      {activeTab === "expenses" && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[24px] border border-slate-200/50 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-40">
                <Select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  options={[
                    { value: "", label: "All Categories" },
                    ...EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))
                  ]}
                />
              </div>
              <div className="w-40">
                <Input
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  placeholder="Start Date"
                />
              </div>
              <div className="w-40">
                <Input
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  placeholder="End Date"
                />
              </div>
              <Button variant="secondary" onClick={loadExpenses}>
                <Filter className="mr-2 h-4 w-4" />
                Filter
              </Button>
              {(filterCategory || filterStartDate || filterEndDate) && (
                <button
                  onClick={handleResetFilters}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear Filters
                </button>
              )}
            </div>
            <Button variant="primary" onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Log Expense
            </Button>
          </div>

          {/* List Table */}
          {loadingExpenses ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
              <PaginatedTable
                rows={expenses.map(e => ({
                  ...e,
                  formattedAmount: formatCurrency(e.amount),
                  dateFormatted: new Date(e.expenseDate).toLocaleDateString(),
                  actions: (
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => handleOpenEdit(e)}
                        className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(e.id)}
                        className="rounded-lg p-1.5 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )
                }))}
                pageSize={10}
                columns={[
                  { key: "dateFormatted", label: "Date" },
                  { key: "category", label: "Category" },
                  { key: "description", label: "Description" },
                  { key: "formattedAmount", label: "Amount" },
                  { key: "createdByName", label: "Logged By" },
                  { key: "actions", label: "" }
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: PROFIT & LOSS */}
      {activeTab === "profit_loss" && (
        <div className="space-y-8">
          {loadingPL ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-brand-500" />
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={TrendingUp}
                  label="Total Revenue"
                  value={formatCurrency(profitLossData?.totalRevenue || 0)}
                  helper="Cumulative settled payments"
                  accent="success"
                />
                <StatCard
                  icon={TrendingDown}
                  label="Total Expenses"
                  value={formatCurrency(profitLossData?.totalExpenses || 0)}
                  helper="Cumulative operational spend"
                  accent="danger"
                />
                <StatCard
                  icon={DollarSign}
                  label="Net Profit"
                  value={formatCurrency(profitLossData?.netProfit || 0)}
                  helper="Revenue minus expenses"
                  accent={profitLossData?.netProfit >= 0 ? "teal" : "danger"}
                />
              </div>

              {/* Monthly Trends Chart */}
              <div className="grid gap-6">
                <ChartContainer
                  title="Monthly Revenue vs Expenses"
                  subtitle="Last 12 months financial performance overview"
                  headerActions={
                    <Button variant="secondary" size="sm" onClick={handleExportPL}>
                      <Download className="mr-2 h-4 w-4" />
                      Export CSV
                    </Button>
                  }
                >
                  <TrendBars
                    data={(profitLossData?.monthlyTrends || []).map(t => ({
                      label: t.label,
                      profit: t.profit
                    }))}
                    valueKey="profit"
                    labelKey="label"
                    formatter={(val) => `₹${(val / 1000).toFixed(0)}k`}
                  />
                </ChartContainer>
              </div>

              {/* Summary breakdown for printing */}
              <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-slate-950/80">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                    <FileText className="h-5 w-5 text-brand-500" />
                    Statement of Profit & Loss
                  </h3>
                  <Button variant="secondary" onClick={() => window.print()}>
                    Print Statement
                  </Button>
                </div>
                
                <div className="border-t border-slate-100 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="flex justify-between py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span>Revenue (Settled Invoices)</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(profitLossData?.totalRevenue || 0)}</span>
                  </div>
                  <div className="flex justify-between py-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span>Expenses (Logged Bills)</span>
                    <span className="text-rose-600 dark:text-rose-400">({formatCurrency(profitLossData?.totalExpenses || 0)})</span>
                  </div>
                  <div className="flex justify-between py-4 text-base font-bold text-slate-900 dark:text-white">
                    <span>Net Operating Profit</span>
                    <span className={profitLossData?.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
                      {formatCurrency(profitLossData?.netProfit || 0)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CRUD MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-950 dark:text-white mb-4">
              {modalMode === "create" ? "Log Expense Record" : "Edit Expense Record"}
            </h3>
            <form onSubmit={handleSubmitExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  options={EXPENSE_CATEGORIES.map(c => ({ value: c, label: c }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Amount (INR / Base Currency)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Expense Date
                </label>
                <Input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                  Description / Notes
                </label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/50 dark:text-white"
                  rows="3"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Rent for clinic premises, internet bills, etc."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  {modalMode === "create" ? "Log Record" : "Save Changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
