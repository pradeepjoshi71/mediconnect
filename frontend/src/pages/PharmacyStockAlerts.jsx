import { AlertTriangle, Search, ShieldAlert, Check } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function PharmacyStockAlerts() {
  const [query, setQuery] = useState("");
  const [alerts, setAlerts] = useState([
    { code: "ASP-75", name: "Aspirin 75mg", current: 8, threshold: 10, type: "low_stock" },
    { code: "ATV-20", name: "Atorvastatin 20mg", current: 2, threshold: 5, type: "critical" },
    { code: "PAR-650", name: "Paracetamol 650mg", current: 100, threshold: 20, type: "clear" }
  ]);

  const handleReorder = (code) => {
    toast.success(`Reorder purchase request triggered for ${code}`);
  };

  const filtered = alerts.filter(a =>
    a.type !== "clear" && (
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.code.toLowerCase().includes(query.toLowerCase())
    )
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inventory Alerts"
        title="Stock Warning Dashboard"
        description="Verify low stock medications, check active reorder levels, and dispatch restock purchase orders."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search stock alerts..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            {
              key: "code",
              label: "Medication Code",
              render: (row) => (
                <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">
                  {row.code}
                </span>
              )
            },
            { key: "name", label: "Medicine Name" },
            { key: "current", label: "Current Stock", render: (row) => `${row.current} units` },
            { key: "threshold", label: "Reorder Level", render: (row) => `${row.threshold} units` },
            {
              key: "type",
              label: "Severity",
              render: (row) => (
                <Badge tone={row.type === "critical" ? "danger" : "warning"}>
                  {row.type.toUpperCase()}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Action",
              render: (row) => (
                <Button size="sm" onClick={() => handleReorder(row.code)}>
                  Trigger restock
                </Button>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}
