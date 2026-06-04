import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FileText, Download, Beaker, Clock, Search } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Input } from "../components/ui/Input";
import { listLabReports, downloadLabReport } from "../services/labService";
import { getUser } from "../services/session";
import { formatDate, formatDateTime } from "../utils/formatters";

export default function PatientReports() {
  const user = getUser();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  async function loadReports() {
    setLoading(true);
    try {
      // For patients, listLabReports automatically filters to their own ID in the service
      const data = await listLabReports(user.patientProfileId);
      setReports(data);
    } catch {
      toast.error("Failed to load diagnostic reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadReports();
  }, []);

  const handleDownload = async (report) => {
    try {
      toast.loading("Downloading report file...", { id: "report" });
      const extension = report.reportFileUrl.split(".").pop().toLowerCase();
      const cleanExtension = ["pdf", "png", "jpg", "jpeg"].includes(extension) ? extension : "pdf";
      const fileName = `${report.testCode.replace(/\s+/g, "_")}_Report_${report.id}.${cleanExtension}`;
      
      await downloadLabReport(report.id, fileName);
      toast.success("Download started!", { id: "report" });
    } catch (err) {
      toast.error("Failed to download report", { id: "report" });
    }
  };

  const filteredReports = reports.filter((r) =>
    r.testName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.testCode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.testCategory?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="My Medical File"
        title="Diagnostic Lab Reports"
        description="Access and download copies of your clinical laboratory reports, imaging files, and diagnostic history."
      />

      <div className="flex max-w-md items-center gap-2">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11"
            placeholder="Search by test name or category..."
          />
        </div>
      </div>

      {loading ? (
        <div className="flex h-[300px] items-center justify-center">
          <div className="text-sm font-semibold text-slate-500">Loading diagnostic reports...</div>
        </div>
      ) : (
        <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
          <PaginatedTable
            rows={filteredReports}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No reports found"
                description="Your reports will appear here once finalized by the lab technician."
              />
            }
            columns={[
              {
                key: "id",
                label: "Report ID",
                render: (row) => <span className="font-mono text-xs font-semibold">REP-{row.id}</span>
              },
              {
                key: "testName",
                label: "Diagnostic test",
                render: (row) => (
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white">{row.testName}</div>
                    <div className="text-xxs font-bold text-brand-600 dark:text-brand-400">{row.testCategory.toUpperCase()} ({row.testCode})</div>
                  </div>
                )
              },
              { key: "uploadedAt", label: "Date Uploaded", render: (row) => formatDateTime(row.uploadedAt) },
              {
                key: "reportNotes",
                label: "Clinical findings",
                render: (row) => (
                  <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm truncate" title={row.reportNotes}>
                    {row.reportNotes || "No notes documented"}
                  </p>
                )
              },
              { key: "uploaderName", label: "Signed By", render: (row) => row.uploaderName || "Lab System" },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <Button size="sm" onClick={() => handleDownload(row)} className="flex items-center gap-1">
                    <Download className="h-4 w-4" /> Download Report
                  </Button>
                )
              }
            ]}
          />
        </div>
      )}
    </div>
  );
}
