import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Beaker,
  FileText,
  DollarSign,
  Briefcase,
  Layers,
  Clock,
  Download,
  AlertCircle
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import {
  listLabTests,
  createLabTest,
  listLabOrders,
  listLabReports,
  downloadLabReport,
  getRevenueReports
} from "../services/labService";
import { formatCurrency, formatDateTime } from "../utils/formatters";

const initialTestForm = {
  testCode: "",
  testName: "",
  category: "General",
  price: 0,
  description: "",
  status: "active"
};

export default function AdminLab() {
  const [activeTab, setActiveTab] = useState("catalog"); // catalog, orders, reports, analytics

  // Catalog States
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [searchTest, setSearchTest] = useState("");
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testForm, setTestForm] = useState(initialTestForm);
  const [submittingTest, setSubmittingTest] = useState(false);

  // Orders States
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [searchOrder, setSearchOrder] = useState("");

  // Reports States
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchReport, setSearchReport] = useState("");

  // Analytics States
  const [revenueStats, setRevenueStats] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  async function loadCatalog() {
    setLoadingTests(true);
    try {
      const data = await listLabTests();
      setTests(data);
    } catch {
      toast.error("Failed to load lab test catalog");
    } finally {
      setLoadingTests(false);
    }
  }

  async function loadOrders() {
    setLoadingOrders(true);
    try {
      const data = await listLabOrders();
      setOrders(data);
    } catch {
      toast.error("Failed to load lab orders");
    } finally {
      setLoadingOrders(false);
    }
  }

  async function loadReports() {
    setLoadingReports(true);
    try {
      const data = await listLabReports();
      setReports(data);
    } catch {
      toast.error("Failed to load lab reports");
    } finally {
      setLoadingReports(false);
    }
  }

  async function loadAnalytics() {
    setLoadingAnalytics(true);
    try {
      const data = await getRevenueReports();
      setRevenueStats(data);
    } catch {
      toast.error("Failed to load lab revenue reports");
    } finally {
      setLoadingAnalytics(false);
    }
  }

  // Load appropriate data on tab change
  useEffect(() => {
    if (activeTab === "catalog") loadCatalog();
    if (activeTab === "orders") loadOrders();
    if (activeTab === "reports") loadReports();
    if (activeTab === "analytics") loadAnalytics();
  }, [activeTab]);

  const handleOpenAddTest = () => {
    setTestForm(initialTestForm);
    setTestModalOpen(true);
  };

  const handleSaveTest = async (e) => {
    e.preventDefault();
    if (!testForm.testCode || !testForm.testName || !testForm.category) {
      toast.error("Please fill all required catalog fields");
      return;
    }

    setSubmittingTest(true);
    try {
      await createLabTest({
        ...testForm,
        price: Number(testForm.price)
      });
      toast.success("Lab test added to catalog!");
      setTestModalOpen(false);
      loadCatalog();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add lab test");
    } finally {
      setSubmittingTest(false);
    }
  };

  const handleDownload = async (report) => {
    try {
      toast.loading("Downloading report...", { id: "report" });
      const extension = report.reportFileUrl.split(".").pop().toLowerCase();
      const cleanExtension = ["pdf", "png", "jpg", "jpeg"].includes(extension) ? extension : "pdf";
      const fileName = `${report.testCode}_Report_${report.id}.${cleanExtension}`;
      await downloadLabReport(report.id, fileName);
      toast.success("Download complete!", { id: "report" });
    } catch (err) {
      toast.error("Download failed", { id: "report" });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Lab Command & Operations"
        title="Laboratory Operations Management"
        description="Administer the diagnostic test master catalog, review physician test orders, audit report filings, and track revenue by lab categories."
      />

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "catalog", label: "Test Catalog Master" },
          { id: "orders", label: "All Lab Orders" },
          { id: "reports", label: "Diagnostic Reports Audit" },
          { id: "analytics", label: "Finance Analytics" }
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

      {/* CATALOG TAB */}
      {activeTab === "catalog" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTest}
                onChange={(e) => setSearchTest(e.target.value)}
                className="pl-11"
                placeholder="Search catalog..."
              />
            </div>
            <Button onClick={handleOpenAddTest} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl">
              <Plus className="h-4 w-4" /> Add Test Master
            </Button>
          </div>

          {loadingTests ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading catalog...</div>
          ) : (
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
              <PaginatedTable
                rows={tests.filter((t) =>
                  t.testName?.toLowerCase().includes(searchTest.toLowerCase()) ||
                  t.testCode?.toLowerCase().includes(searchTest.toLowerCase()) ||
                  t.category?.toLowerCase().includes(searchTest.toLowerCase())
                )}
                pageSize={10}
                columns={[
                  { key: "testCode", label: "Code", render: (row) => <span className="font-mono font-semibold">{row.testCode}</span> },
                  { key: "testName", label: "Test Name" },
                  { key: "category", label: "Category" },
                  { key: "price", label: "Charge (INR)", render: (row) => <span className="font-semibold">{formatCurrency(row.price * 100)}</span> },
                  { key: "description", label: "Clinical Description", render: (row) => <span className="text-xs text-slate-500 dark:text-slate-400 max-w-xs truncate block">{row.description || "N/A"}</span> },
                  { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "active" ? "teal" : "red"}>{row.status.toUpperCase()}</Badge> }
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchOrder}
              onChange={(e) => setSearchOrder(e.target.value)}
              className="pl-11"
              placeholder="Search orders..."
            />
          </div>

          {loadingOrders ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading orders...</div>
          ) : (
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
              <PaginatedTable
                rows={orders.filter((o) =>
                  o.patientName?.toLowerCase().includes(searchOrder.toLowerCase()) ||
                  o.patientMRN?.toLowerCase().includes(searchOrder.toLowerCase()) ||
                  o.testName?.toLowerCase().includes(searchOrder.toLowerCase()) ||
                  o.testCode?.toLowerCase().includes(searchOrder.toLowerCase())
                )}
                pageSize={10}
                columns={[
                  { key: "id", label: "Order ID", render: (row) => <span className="font-mono text-xs font-semibold">ORD-{row.id}</span> },
                  { key: "patientName", label: "Patient" },
                  { key: "patientMRN", label: "MRN" },
                  { key: "testName", label: "Test Ordered", render: (row) => `${row.testName} (${row.testCode})` },
                  { key: "doctorName", label: "Physician" },
                  { key: "orderedAt", label: "Ordered At", render: (row) => formatDateTime(row.orderedAt) },
                  {
                    key: "orderStatus",
                    label: "Status",
                    render: (row) => {
                      let tone = "neutral";
                      if (row.orderStatus === "ORDERED") tone = "amber";
                      if (row.orderStatus === "SAMPLE_COLLECTED") tone = "indigo";
                      if (row.orderStatus === "PROCESSING") tone = "indigo";
                      if (row.orderStatus === "COMPLETED") tone = "teal";
                      if (row.orderStatus === "CANCELLED") tone = "red";
                      return <Badge tone={tone}>{row.orderStatus.replace("_", " ")}</Badge>;
                    }
                  }
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* REPORTS AUDIT TAB */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchReport}
              onChange={(e) => setSearchReport(e.target.value)}
              className="pl-11"
              placeholder="Search reports..."
            />
          </div>

          {loadingReports ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading reports...</div>
          ) : (
            <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
              <PaginatedTable
                rows={reports.filter((r) =>
                  r.patientName?.toLowerCase().includes(searchReport.toLowerCase()) ||
                  r.patientMRN?.toLowerCase().includes(searchReport.toLowerCase()) ||
                  r.testName?.toLowerCase().includes(searchReport.toLowerCase()) ||
                  r.testCode?.toLowerCase().includes(searchReport.toLowerCase())
                )}
                pageSize={10}
                columns={[
                  { key: "id", label: "Report ID", render: (row) => <span className="font-mono text-xs font-semibold">REP-{row.id}</span> },
                  { key: "patientName", label: "Patient" },
                  { key: "patientMRN", label: "MRN" },
                  { key: "testName", label: "Test", render: (row) => `${row.testName} (${row.testCode})` },
                  { key: "uploaderName", label: "Uploaded By", render: (row) => row.uploaderName || "System" },
                  { key: "uploadedAt", label: "Uploaded At", render: (row) => formatDateTime(row.uploadedAt) },
                  {
                    key: "actions",
                    label: "Actions",
                    render: (row) => (
                      <Button size="sm" variant="outline" onClick={() => handleDownload(row)}>
                        <Download className="h-4 w-4 mr-1" /> PDF
                      </Button>
                    )
                  }
                ]}
              />
            </div>
          )}
        </div>
      )}

      {/* FINANCE ANALYTICS TAB */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          {loadingAnalytics ? (
            <div className="py-12 text-center text-sm text-slate-500">Loading financial reports...</div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {revenueStats.map((item, idx) => (
                <Card key={idx}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
                      {item.testCategory}
                    </CardTitle>
                    <Badge tone="teal">{item.ordersCount} Completed Tests</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-black text-slate-900 dark:text-white">
                      {formatCurrency(Number(item.totalRevenue) * 100)}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Total settled diagnostic billing</p>
                  </CardContent>
                </Card>
              ))}

              {revenueStats.length === 0 && (
                <div className="col-span-full">
                  <EmptyState
                    title="No revenue generated"
                    description="Completed lab orders with pricing will generate revenue charts here."
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Test master Modal */}
      <Modal
        open={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Add Diagnostic Lab Test Master"
      >
        <form onSubmit={handleSaveTest} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Test Code *</label>
              <Input
                placeholder="e.g. CBC, Lipid, MRI_BRAIN"
                value={testForm.testCode}
                onChange={(e) => setTestForm((c) => ({ ...c, testCode: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Test Name *</label>
              <Input
                placeholder="e.g. Complete Blood Count"
                value={testForm.testName}
                onChange={(e) => setTestForm((c) => ({ ...c, testName: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Category *</label>
              <Input
                placeholder="e.g. Hematology, Biochemistry, Radiology"
                value={testForm.category}
                onChange={(e) => setTestForm((c) => ({ ...c, category: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Price (INR) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="350"
                value={testForm.price}
                onChange={(e) => setTestForm((c) => ({ ...c, price: Number(e.target.value) }))}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Clinical Description</label>
            <textarea
              value={testForm.description}
              onChange={(e) => setTestForm((c) => ({ ...c, description: e.target.value }))}
              rows={3}
              placeholder="Enter details on test indications, reference values..."
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setTestModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={submittingTest} className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl">
              Save Test Master
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
