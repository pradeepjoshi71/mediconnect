import { Beaker, Search, Calendar, UserCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function LabSampleCollection() {
  const [query, setQuery] = useState("");
  const [samples, setSamples] = useState([
    { id: 1, patient: "Maya Rao", MRN: "MRN-BLR-10001", test: "Lipid Profile Panel", status: "ordered", time: "10:30 AM" },
    { id: 2, patient: "Rohan Das", MRN: "MRN-BLR-10045", test: "Complete Blood Count", status: "ordered", time: "11:00 AM" },
    { id: 3, patient: "Sita Nair", MRN: "MRN-BLR-10046", test: "Thyroid Profile", status: "collected", time: "09:15 AM" }
  ]);

  const handleCollect = (id) => {
    setSamples(prev =>
      prev.map(s => s.id === id ? { ...s, status: "collected" } : s)
    );
    toast.success("Sample marked as collected");
  };

  const filtered = samples.filter(s =>
    s.patient.toLowerCase().includes(query.toLowerCase()) ||
    s.test.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Diagnostic Laboratory"
        title="Sample Collection Queue"
        description="Verify patient identities, register collection vial labels, and update orders status in real time."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search pending collections..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Order ID", render: (row) => `ORD-${row.id}` },
            { key: "patient", label: "Patient" },
            { key: "MRN", label: "MRN" },
            {
              key: "test",
              label: "Test details",
              render: (row) => (
                <div className="flex items-center gap-2 font-semibold">
                  <Beaker className="h-4 w-4 text-brand-500" />
                  <span>{row.test}</span>
                </div>
              )
            },
            { key: "time", label: "Scheduled Slot" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "collected" ? "success" : "warning"}>
                  {row.status.replace("_", " ")}
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                row.status === "ordered" ? (
                  <Button size="sm" onClick={() => handleCollect(row.id)}>
                    <UserCheck className="h-3.5 w-3.5" />
                    Collect Sample
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold">Sample Collected</span>
                )
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
