import { Users, Search, Bed, User } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Input } from "../components/ui/Input";
import { useState } from "react";

export default function NursePatients() {
  const [query, setQuery] = useState("");
  const patients = [
    { room: "Room 102-A", name: "Maya Rao", MRN: "MRN-BLR-10001", gender: "Female", doctor: "Dr. Rohan Mehta", diagnosis: "Stable angina under monitoring" },
    { room: "Room 105-B", name: "Rohan Das", MRN: "MRN-BLR-10045", gender: "Male", doctor: "Dr. Rohan Mehta", diagnosis: "Post-op appendectomy recovery" }
  ];

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.room.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Inpatient Care"
        title="Assigned Patients Registry"
        description="Verify active clinical ward allocations, check patient diagnoses, and identify attending physicians."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search ward patients..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            {
              key: "room",
              label: "Bed Allocation",
              render: (row) => (
                <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
                  <Bed className="h-4 w-4 text-slate-400" />
                  <span>{row.room}</span>
                </div>
              )
            },
            { key: "name", label: "Patient" },
            { key: "MRN", label: "MRN" },
            { key: "gender", label: "Gender" },
            { key: "doctor", label: "Attending Doctor" },
            { key: "diagnosis", label: "Primary Diagnosis" }
          ]}
        />
      </div>
    </div>
  );
}
