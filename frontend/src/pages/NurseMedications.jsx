import { Pill, Search, Clock, Check } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function NurseMedications() {
  const [query, setQuery] = useState("");
  const [meds, setMeds] = useState([
    { id: 1, patient: "Maya Rao", medicine: "Aspirin 75mg", time: "18:00", status: "pending" },
    { id: 2, patient: "Rohan Das", medicine: "Paracetamol 650mg", time: "16:30", status: "given" }
  ]);

  const handleAdminister = (id) => {
    setMeds(prev =>
      prev.map(m => m.id === id ? { ...m, status: "given" } : m)
    );
    toast.success("Medication administration recorded (MAR)");
  };

  const filtered = meds.filter(m =>
    m.patient.toLowerCase().includes(query.toLowerCase()) ||
    m.medicine.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Medication Schedule"
        title="Medication Administration Record (MAR)"
        description="Verify physician prescription orders, log active packet dispensation, and trace delivery times."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search pending medications..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Administration ID", render: (row) => `MAR-${row.id}` },
            { key: "patient", label: "Patient" },
            {
              key: "medicine",
              label: "Medication Details",
              render: (row) => (
                <div className="flex items-center gap-2 font-semibold">
                  <Pill className="h-4 w-4 text-brand-500" />
                  <span>{row.medicine}</span>
                </div>
              )
            },
            {
              key: "time",
              label: "Target Schedule Time",
              render: (row) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>Today at {row.time}</span>
                </div>
              )
            },
            {
              key: "status",
              label: "Delivery Status",
              render: (row) => (
                <Badge tone={row.status === "given" ? "success" : "warning"}>
                  {row.status.toUpperCase()}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Administration",
              render: (row) => (
                row.status === "pending" ? (
                  <Button size="sm" onClick={() => handleAdminister(row.id)}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Log Administer
                  </Button>
                ) : (
                  <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Administered
                  </span>
                )
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
