import { Pill, Search, ClipboardList, CheckCircle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function PharmacyPrescriptions() {
  const [query, setQuery] = useState("");
  const [prescriptions, setPrescriptions] = useState([
    { id: 401, patient: "Maya Rao", MRN: "MRN-BLR-10001", medicine: "Aspirin 75mg", quantity: 30, status: "pending" },
    { id: 402, patient: "Rohan Das", MRN: "MRN-BLR-10045", medicine: "Paracetamol 650mg", quantity: 15, status: "pending" },
    { id: 403, patient: "Sita Nair", MRN: "MRN-BLR-10046", medicine: "Atorvastatin 20mg", quantity: 30, status: "dispensed" }
  ]);

  const handleDispense = (id) => {
    setPrescriptions(prev =>
      prev.map(p => p.id === id ? { ...p, status: "dispensed" } : p)
    );
    toast.success("Medications dispensed and logged");
  };

  const filtered = prescriptions.filter(p =>
    p.patient.toLowerCase().includes(query.toLowerCase()) ||
    p.medicine.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pharmacy Operations"
        title="Prescriptions Queue"
        description="Verify active clinical prescriptions, check dosage instruction compliance, and log dispensed packets."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search pending prescriptions..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Prescription RX", render: (row) => `RX-${row.id}` },
            { key: "patient", label: "Patient" },
            { key: "MRN", label: "MRN" },
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
            { key: "quantity", label: "Quantity Due" },
            {
              key: "status",
              label: "RX Status",
              render: (row) => (
                <Badge tone={row.status === "dispensed" ? "success" : "warning"}>
                  {row.status.toUpperCase()}
                </Badge>
              ),
            },
            {
              key: "actions",
              label: "Dispensation Action",
              render: (row) => (
                row.status === "pending" ? (
                  <Button size="sm" onClick={() => handleDispense(row.id)}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Dispense
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Dispensed
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
