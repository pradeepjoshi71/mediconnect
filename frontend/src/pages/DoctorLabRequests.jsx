import { Beaker, Search, AlertCircle, Plus } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { useState } from "react";

export default function DoctorLabRequests() {
  const [query, setQuery] = useState("");
  const labRequests = [
    { id: 201, patient: "Maya Rao", test: "Lipid Profile Panel", priority: "routine", status: "pending", date: "2026-06-07" },
    { id: 202, patient: "Maya Rao", test: "Troponin T Assay", priority: "urgent", status: "completed", date: "2026-06-07" },
    { id: 203, patient: "Aarav Sharma", test: "Complete Blood Count (CBC)", priority: "routine", status: "sample_collected", date: "2026-06-06" }
  ];

  const filtered = labRequests.filter(l =>
    l.patient.toLowerCase().includes(query.toLowerCase()) ||
    l.test.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diagnostics"
        title="Lab Orders Workspace"
        description="Verify statuses of ordered lab investigations, track sample collections, and retrieve reports."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search patient or test panel..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Request ID" },
            { key: "patient", label: "Patient Name" },
            {
              key: "test",
              label: "Requested Test",
              render: (row) => (
                <div className="flex items-center gap-2 font-semibold">
                  <Beaker className="h-4 w-4 text-teal-500" />
                  <span>{row.test}</span>
                </div>
              )
            },
            {
              key: "priority",
              label: "Priority",
              render: (row) => (
                <Badge tone={row.priority === "urgent" ? "danger" : "slate"}>
                  {row.priority}
                </Badge>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "completed" ? "success" : row.status === "pending" ? "warning" : "teal"}>
                  {row.status.replace("_", " ")}
                </Badge>
              )
            },
            { key: "date", label: "Request Date" }
          ]}
        />
      </div>
    </div>
  );
}
