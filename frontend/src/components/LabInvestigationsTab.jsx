import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Beaker, Plus, Download, FileText, CheckCircle2, Clock } from "lucide-react";
import { Button } from "./ui/Button";
import { Badge } from "./ui/Badge";
import { EmptyState } from "./ui/EmptyState";
import { Modal } from "./ui/Modal";
import { Select } from "./ui/Select";
import { listLabTests, listLabOrders, createLabOrder, listLabReports, downloadLabReport } from "../services/labService";
import { formatDateTime } from "../utils/formatters";

export default function LabInvestigationsTab({ patientId, isDoctorOrAdmin }) {
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Order modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [ordering, setOrdering] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const [testsList, ordersList, reportsList] = await Promise.all([
        listLabTests(),
        listLabOrders({ patientId }),
        listLabReports(patientId)
      ]);
      setTests(testsList.filter(t => t.status === "active"));
      setOrders(ordersList);
      setReports(reportsList);
      if (testsList.length > 0 && !selectedTestId) {
        setSelectedTestId(testsList[0].id);
      }
    } catch {
      toast.error("Failed to load lab investigations history");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (patientId) {
      loadData();
    }
  }, [patientId]);

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!selectedTestId) {
      toast.error("Please select a test profile");
      return;
    }

    setOrdering(true);
    try {
      await createLabOrder({
        patientId,
        testId: Number(selectedTestId)
      });
      toast.success("Lab test ordered successfully!");
      setOrderModalOpen(false);
      loadData();
    } catch (err) {
      toast.error("Failed to order lab test");
    } finally {
      setOrdering(false);
    }
  };

  const handleDownloadReport = async (report) => {
    try {
      toast.loading("Downloading report...", { id: "report" });
      const extension = report.reportFileUrl.split(".").pop().toLowerCase();
      const cleanExtension = ["pdf", "png", "jpg", "jpeg"].includes(extension) ? extension : "pdf";
      const fileName = `${report.testCode}_Report_${report.id}.${cleanExtension}`;
      await downloadLabReport(report.id, fileName);
      toast.success("Download started!", { id: "report" });
    } catch (err) {
      toast.error("Failed to download report", { id: "report" });
    }
  };

  if (loading) {
    return <div className="text-center text-sm font-semibold text-slate-500 py-6 animate-pulse">Loading lab investigations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Beaker className="h-5 w-5 text-brand-600" /> Laboratory Investigations
        </h3>
        {isDoctorOrAdmin && (
          <Button size="sm" onClick={() => setOrderModalOpen(true)} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
            <Plus className="h-4 w-4" /> Order Lab Test
          </Button>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Lab Orders List */}
        <div className="space-y-4 rounded-3xl border border-slate-200/60 bg-white/50 p-5 dark:border-neutral-200/10 dark:bg-neutral-100/5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Test Orders history</h4>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {orders.length ? (
              orders.map((o) => {
                let tone = "neutral";
                if (o.orderStatus === "ORDERED") tone = "amber";
                if (o.orderStatus === "SAMPLE_COLLECTED") tone = "indigo";
                if (o.orderStatus === "PROCESSING") tone = "indigo";
                if (o.orderStatus === "COMPLETED") tone = "teal";
                if (o.orderStatus === "CANCELLED") tone = "red";
                return (
                  <div key={o.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-neutral-200/5 bg-white dark:bg-neutral-100/5 hover:bg-slate-50/50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white">{o.testName}</div>
                      <div className="mt-1 flex items-center gap-2 text-xxs text-slate-400 dark:text-neutral-500">
                        <span>Ordered: {formatDateTime(o.orderedAt)}</span>
                        <span>•</span>
                        <span>Dr: {o.doctorName}</span>
                      </div>
                    </div>
                    <Badge tone={tone}>{o.orderStatus.replace("_", " ")}</Badge>
                  </div>
                );
              })
            ) : (
              <EmptyState title="No tests ordered" description="No lab orders have been requested for this patient." />
            )}
          </div>
        </div>

        {/* Finalized Lab Reports */}
        <div className="space-y-4 rounded-3xl border border-slate-200/60 bg-white/50 p-5 dark:border-neutral-200/10 dark:bg-neutral-100/5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Diagnostic Reports</h4>
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {reports.length ? (
              reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-100 dark:border-neutral-200/5 bg-white dark:bg-neutral-100/5 hover:bg-slate-50/50 dark:hover:bg-neutral-100/10 transition-colors duration-200">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-brand-600 dark:text-brand-400" /> {r.testName}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xxs text-slate-400 dark:text-neutral-500">
                      <span>Date: {formatDateTime(r.uploadedAt)}</span>
                      <span>•</span>
                      <span>By: {r.uploaderName || "Technician"}</span>
                    </div>
                    {r.reportNotes && (
                      <p className="mt-1.5 text-xxs italic text-slate-500 dark:text-neutral-500 max-w-xs truncate">{r.reportNotes}</p>
                    )}
                  </div>
                  <Button size="xs" variant="ghost" onClick={() => handleDownloadReport(r)} className="hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-950/30 dark:hover:text-brand-400 rounded-xl">
                    <Download className="h-4 w-4 text-slate-650 dark:text-slate-350" />
                  </Button>
                </div>
              ))
            ) : (
              <EmptyState title="No reports finalized" description="Diagnostic reports will appear here once uploaded by the lab technician." />
            )}
          </div>
        </div>
      </div>

      {/* Order Test Modal */}
      <Modal open={orderModalOpen} onClose={() => setOrderModalOpen(false)} title="Order Diagnostic Lab Test">
        <form onSubmit={handlePlaceOrder} className="space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-neutral-500 mb-1.5">Select Test Profile *</label>
            <Select
              value={selectedTestId}
              onChange={(e) => setSelectedTestId(e.target.value)}
              className="bg-white"
              required
            >
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  [{test.testCode}] {test.testName} (Category: {test.category})
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 dark:border-neutral-200/5">
            <Button type="button" variant="outline" onClick={() => setOrderModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={ordering} className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl">
              Place Test Order
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
