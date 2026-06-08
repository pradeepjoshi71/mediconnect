import { FileText, Search, FileDown, UploadCloud } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function LabReports() {
  const [query, setQuery] = useState("");
  const reports = [
    { id: 301, patient: "Maya Rao", test: "Lipid Profile Panel", status: "completed", date: "2026-06-07", file: "lipid-report.pdf" },
    { id: 302, patient: "Vikram Shah", test: "Thyroid Stimulating Hormone", status: "completed", date: "2026-06-05", file: "tsh-report.pdf" }
  ];

  const filtered = reports.filter(r =>
    r.patient.toLowerCase().includes(query.toLowerCase()) ||
    r.test.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diagnostic Laboratory"
        title="Diagnostic Reports Log"
        description="Verify uploaded patient PDF records, check medical references, and manage laboratory audit histories."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search completed reports..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Report ID", render: (row) => `RPT-${row.id}` },
            { key: "patient", label: "Patient" },
            { key: "test", label: "Test Panel" },
            { key: "date", label: "Uploaded Date" },
            {
              key: "status",
              label: "Report Status",
              render: (row) => (
                <Badge tone="success">
                  {row.status.toUpperCase()}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Download",
              render: (row) => (
                <Button size="sm" onClick={() => toast.success(`Starting download of ${row.file}`)}>
                  <FileDown className="h-3.5 w-3.5 mr-1" /> PDF
                </Button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
