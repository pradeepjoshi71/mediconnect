import { Activity, Beaker, Search, Clipboard, Play } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function LabTestResults() {
  const [query, setQuery] = useState("");
  const [tests, setTests] = useState([
    { id: 101, patient: "Maya Rao", test: "Lipid Profile", status: "processing", notes: "" },
    { id: 102, patient: "Arjun Dev", test: "Hemoglobin A1c", status: "collected", notes: "" }
  ]);

  const handleStart = (id) => {
    setTests(prev =>
      prev.map(t => t.id === id ? { ...t, status: "processing" } : t)
    );
    toast.success("Test run initiated");
  };

  const handleLogResult = (id, resultText) => {
    setTests(prev =>
      prev.map(t => t.id === id ? { ...t, status: "completed", notes: resultText } : t)
    );
    toast.success("Test results documented successfully");
  };

  const filtered = tests.filter(t =>
    t.patient.toLowerCase().includes(query.toLowerCase()) ||
    t.test.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clinical Analysis"
        title="Diagnostic Results Entry"
        description="Verify assay runs, record clinical laboratory test inputs, and log critical reference warnings."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search active assay tests..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Assay ID", render: (row) => `ASY-${row.id}` },
            { key: "patient", label: "Patient" },
            { key: "test", label: "Assay Panel" },
            {
              key: "status",
              label: "Assay Status",
              render: (row) => (
                <Badge tone={row.status === "completed" ? "success" : row.status === "processing" ? "indigo" : "warning"}>
                  {row.status.toUpperCase()}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Workspace Action",
              render: (row) => (
                row.status === "collected" ? (
                  <Button size="sm" onClick={() => handleStart(row.id)}>
                    <Play className="h-3.5 w-3.5" /> Start Processing
                  </Button>
                ) : row.status === "processing" ? (
                  <div className="flex gap-2">
                    <Input
                      placeholder="e.g., HbA1c 5.8%"
                      size="sm"
                      id={`res-${row.id}`}
                      className="h-8 py-1 max-w-[140px]"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const val = document.getElementById(`res-${row.id}`)?.value;
                        if (!val) {
                          toast.error("Please enter a result value first");
                          return;
                        }
                        handleLogResult(row.id, val);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <span className="text-xs text-emerald-500 font-semibold">{row.notes}</span>
                )
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
