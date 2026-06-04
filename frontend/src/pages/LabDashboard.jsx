import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  FileText,
  Search,
  UploadCloud,
  CheckCircle2,
  Clock,
  Beaker,
  AlertCircle,
  FileDown,
  XCircle,
  Play
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Card, CardContent } from "../components/ui/Card";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { listLabOrders, updateLabOrderStatus, createLabReport, downloadLabReport } from "../services/labService";
import { formatDate, formatDateTime, statusTone } from "../utils/formatters";

export default function LabDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("PENDING"); // PENDING, PROCESSING, COMPLETED, ALL

  // Upload report modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [reportFile, setReportFile] = useState(null);
  const [reportNotes, setReportNotes] = useState("");
  const [uploading, setUploading] = useState(false);

  async function loadOrders() {
    setLoading(true);
    try {
      const data = await listLabOrders();
      setOrders(data);
    } catch {
      toast.error("Failed to load lab orders");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrders();
  }, []);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      await updateLabOrderStatus(orderId, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update order status");
    }
  };

  const handleOpenUploadModal = (order) => {
    setSelectedOrder(order);
    setReportFile(null);
    setReportNotes("");
    setUploadModalOpen(true);
  };

  const handleUploadReport = async (e) => {
    e.preventDefault();
    if (!reportFile) {
      toast.error("Please select a report file to upload");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("labOrderId", selectedOrder.id);
      formData.append("reportNotes", reportNotes);
      formData.append("file", reportFile);

      await createLabReport(formData);
      toast.success("Diagnostic report uploaded and order marked completed!");
      setUploadModalOpen(false);
      loadOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload report");
    } finally {
      setUploading(false);
    }
  };

  // Filter orders based on active tab and search
  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.patientMRN?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.testName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.testCode?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeTab === "PENDING") {
      return ["ORDERED", "SAMPLE_COLLECTED"].includes(o.orderStatus);
    }
    if (activeTab === "PROCESSING") {
      return o.orderStatus === "PROCESSING";
    }
    if (activeTab === "COMPLETED") {
      return o.orderStatus === "COMPLETED";
    }
    return true; // ALL
  });

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Diagnostic Laboratory"
        title="Lab Technician Command Center"
        description="Monitor pending patient tests, collect clinical biological samples, execute test profiles, and upload final diagnostic reports."
      />

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        {[
          { id: "PENDING", label: "Pending Samples" },
          { id: "PROCESSING", label: "Processing" },
          { id: "COMPLETED", label: "Completed" },
          { id: "ALL", label: "All Orders" }
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
            placeholder="Search by patient name, MRN, or test code..."
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading lab orders...</div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredOrders}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No orders found"
                description="Orders placed by care physicians will appear here."
              />
            }
            columns={[
              {
                key: "id",
                label: "Order ID",
                render: (row) => <span className="font-mono text-xs font-semibold">ORD-{row.id}</span>
              },
              { key: "patientName", label: "Patient" },
              { key: "patientMRN", label: "MRN" },
              {
                key: "testName",
                label: "Test details",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.testName}</div>
                    <div className="text-xxs font-bold text-brand-600 dark:text-brand-400">{row.testCategory.toUpperCase()} ({row.testCode})</div>
                  </div>
                )
              },
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
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex flex-wrap gap-2">
                    {row.orderStatus === "ORDERED" && (
                      <Button size="sm" onClick={() => handleUpdateStatus(row.id, "SAMPLE_COLLECTED")}>
                        <Beaker className="h-3.5 w-3.5 mr-1" /> Collect Sample
                      </Button>
                    )}
                    {row.orderStatus === "SAMPLE_COLLECTED" && (
                      <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => handleUpdateStatus(row.id, "PROCESSING")}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Start Processing
                      </Button>
                    )}
                    {row.orderStatus === "PROCESSING" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleOpenUploadModal(row)}>
                        <UploadCloud className="h-3.5 w-3.5 mr-1" /> Upload Results
                      </Button>
                    )}
                    {["ORDERED", "SAMPLE_COLLECTED", "PROCESSING"].includes(row.orderStatus) && (
                      <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => handleUpdateStatus(row.id, "CANCELLED")}>
                        Cancel
                      </Button>
                    )}
                    {row.orderStatus === "COMPLETED" && (
                      <span className="text-slate-400 text-xs italic flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal-500" /> Completed
                      </span>
                    )}
                    {row.orderStatus === "CANCELLED" && (
                      <span className="text-slate-400 text-xs italic flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5 text-red-500" /> Cancelled
                      </span>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Upload Diagnostic Report Modal */}
      <Modal
        open={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        title={`Upload Diagnostic Results: ORD-${selectedOrder?.id}`}
      >
        <form onSubmit={handleUploadReport} className="space-y-4">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-400 font-bold uppercase">Test Ordered</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedOrder?.testName} ({selectedOrder?.testCode})
            </div>
            <div className="mt-2 text-xs text-slate-400 font-bold uppercase">Patient</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {selectedOrder?.patientName} (MRN: {selectedOrder?.patientMRN})
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Report File (PDF, PNG, JPG) *
            </label>
            <Input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setReportFile(e.target.files[0])}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Lab Technician Notes / Clinical Remarks
            </label>
            <textarea
              value={reportNotes}
              onChange={(e) => setReportNotes(e.target.value)}
              rows={4}
              placeholder="Enter lab findings, reference ranges, critical values, etc."
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setUploadModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={uploading} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl">
              Submit & Complete Test
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
