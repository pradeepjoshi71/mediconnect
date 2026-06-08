import { DollarSign, Search, Receipt, CheckCircle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import { formatCurrency } from "../utils/formatters";

export default function PharmacySales() {
  const [query, setQuery] = useState("");
  const sales = [
    { id: 501, rx: "RX-401", patient: "Maya Rao", amount: 4500, date: "2026-06-07 14:15", status: "settled" },
    { id: 502, rx: "RX-403", patient: "Sita Nair", amount: 9000, date: "2026-06-07 11:30", status: "settled" }
  ];

  const filtered = sales.filter(s =>
    s.patient.toLowerCase().includes(query.toLowerCase()) ||
    s.rx.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pharmacy Operations"
        title="Direct Sales & Invoices"
        description="Verify OTC sales transactions, collect dispense billing payments, and check settlement logs."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search sales transactions..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "id", label: "Invoice ID", render: (row) => `PHM-${row.id}` },
            {
              key: "rx",
              label: "Prescription Source",
              render: (row) => (
                <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-xs">
                  <Receipt className="h-4 w-4 text-slate-400" />
                  <span>{row.rx}</span>
                </div>
              )
            },
            { key: "patient", label: "Patient" },
            { key: "date", label: "Sales Time" },
            {
              key: "amount",
              label: "Total Amount",
              render: (row) => formatCurrency(row.amount)
            },
            {
              key: "status",
              label: "Payment Status",
              render: (row) => (
                <Badge tone="success">
                  {row.status.toUpperCase()}
                </Badge>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
