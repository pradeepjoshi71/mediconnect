import { Pill, Search, Layers, Plus } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";
import { formatCurrency } from "../utils/formatters";

export default function PharmacyInventory() {
  const [query, setQuery] = useState("");
  const medicines = [
    { code: "ASP-75", name: "Aspirin 75mg", generic: "Acetylsalicylic Acid", manufacturer: "Bayer", stock: 50, reorder: 10, price: 150 },
    { code: "ATV-20", name: "Atorvastatin 20mg", generic: "Atorvastatin Calcium", manufacturer: "Pfizer", stock: 40, reorder: 5, price: 300 },
    { code: "PAR-650", name: "Paracetamol 650mg", generic: "Paracetamol", manufacturer: "GSK", stock: 100, reorder: 20, price: 50 }
  ];

  const filtered = medicines.filter(m =>
    m.name.toLowerCase().includes(query.toLowerCase()) ||
    m.code.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Pharmacy Operations"
        title="Medicines Catalog & Inventory"
        description="Monitor current stock levels, verify batch details, reorder triggers, and unit prices."
        actions={
          <Button onClick={() => toast.success("New medicines are seeded/added via system migrations.")}>
            <Plus className="h-4 w-4" /> Add Medication
          </Button>
        }
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search medicine database..."
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
            { key: "generic", label: "Generic Name" },
            { key: "manufacturer", label: "Manufacturer" },
            { key: "stock", label: "Stock Quantity", render: (row) => `${row.stock} units` },
            { key: "reorder", label: "Reorder Trigger", render: (row) => `${row.reorder} units` },
            {
              key: "price",
              label: "Unit Price",
              render: (row) => formatCurrency(row.price)
            }
          ]}
        />
      </div>
    </div>
  );
}
