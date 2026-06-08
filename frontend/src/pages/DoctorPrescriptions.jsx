import { Pill, Search, Clipboard, Plus } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Card, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { useState } from "react";

export default function DoctorPrescriptions() {
  const [query, setQuery] = useState("");
  const prescriptions = [
    { id: 1, patient: "Maya Rao", MRN: "MRN-BLR-10001", medicine: "Aspirin 75mg", frequency: "Once daily", duration: "30 days", status: "active", date: "2026-06-07" },
    { id: 2, patient: "Maya Rao", MRN: "MRN-BLR-10001", medicine: "Atorvastatin 20mg", frequency: "Once daily at bedtime", duration: "30 days", status: "active", date: "2026-06-07" },
    { id: 3, patient: "Vikram Shah", MRN: "MRN-BLR-10042", medicine: "Amoxicillin 500mg", frequency: "Thrice daily", duration: "7 days", status: "completed", date: "2026-05-20" }
  ];

  const filtered = prescriptions.filter(p =>
    p.patient.toLowerCase().includes(query.toLowerCase()) ||
    p.medicine.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clinical Workflows"
        title="Prescriptions History"
        description="Search past medications written to patients, review dosage instructions, and check active statuses."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search patient or medication..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "patient", label: "Patient" },
            { key: "MRN", label: "Medical Record No." },
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
            { key: "frequency", label: "Frequency" },
            { key: "duration", label: "Duration" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "active" ? "success" : "slate"}>
                  {row.status}
                </Badge>
              )
            },
            { key: "date", label: "Date Written" }
          ]}
        />
      </div>
    </div>
  );
}
