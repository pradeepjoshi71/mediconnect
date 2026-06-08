import { Receipt, DollarSign, Search, CheckCircle, AlertTriangle } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";
import { formatCurrency } from "../utils/formatters";

export default function ReceptionPayments() {
  const [query, setQuery] = useState("");
  const [transactions, setTransactions] = useState([
    { id: 1, invoice: "INV-BLR-10001", patient: "Maya Rao", amount: 6500, status: "paid", method: "Stripe Card" },
    { id: 2, invoice: "INV-BLR-10042", patient: "Arjun Dev", amount: 5000, status: "pending", method: "Cash" },
    { id: 3, invoice: "INV-BLR-10043", patient: "Asha Varma", amount: 12000, status: "paid", method: "Stripe Card" }
  ]);

  const handleSettle = (id) => {
    setTransactions(prev =>
      prev.map(t => t.id === id ? { ...t, status: "paid" } : t)
    );
    toast.success("Transaction marked as settled");
  };

  const filtered = transactions.filter(t =>
    t.patient.toLowerCase().includes(query.toLowerCase()) ||
    t.invoice.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Cashier Desk"
        title="Payment Operations Desk"
        description="Review billing invoices, process direct cash collection, and record credit card transaction entries."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search invoice or patient..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            {
              key: "invoice",
              label: "Invoice No.",
              render: (row) => (
                <div className="flex items-center gap-1 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  <Receipt className="h-4 w-4 text-slate-400" />
                  <span>{row.invoice}</span>
                </div>
              )
            },
            { key: "patient", label: "Patient" },
            {
              key: "amount",
              label: "Amount Due",
              render: (row) => formatCurrency(row.amount)
            },
            { key: "method", label: "Payment Method" },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "paid" ? "success" : "danger"}>
                  {row.status}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Settlement Actions",
              render: (row) => (
                row.status === "pending" ? (
                  <Button size="sm" onClick={() => handleSettle(row.id)}>
                    <DollarSign className="h-3.5 w-3.5" />
                    Settle Cash
                  </Button>
                ) : (
                  <span className="text-xs text-emerald-500 font-semibold flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5" /> Paid
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
