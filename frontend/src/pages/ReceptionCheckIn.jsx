import { UserCheck, Users, Clock, Search } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useState } from "react";
import toast from "react-hot-toast";

export default function ReceptionCheckIn() {
  const [query, setQuery] = useState("");
  const [patients, setPatients] = useState([
    { id: 1, name: "Maya Rao", doctor: "Dr. Rohan Mehta", time: "10:00 AM", status: "scheduled" },
    { id: 2, name: "Arjun Dev", doctor: "Dr. Rohan Mehta", time: "10:30 AM", status: "scheduled" },
    { id: 3, name: "Asha Varma", doctor: "Dr. Rohan Mehta", time: "11:00 AM", status: "checked_in" }
  ]);

  const handleCheckIn = (id) => {
    setPatients(prev =>
      prev.map(p => p.id === id ? { ...p, status: "checked_in" } : p)
    );
    toast.success("Patient checked in successfully");
  };

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.doctor.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Front Desk Operations"
        title="Check-In Desk Workspace"
        description="Verify arrivals, register active patient queues, and toggle consultation start statuses."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search scheduled arrivals..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <PaginatedTable
          rows={filtered}
          pageSize={10}
          columns={[
            { key: "name", label: "Patient" },
            { key: "doctor", label: "Assigned Doctor" },
            {
              key: "time",
              label: "Appointment Slot",
              render: (row) => (
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Clock className="h-3.5 w-3.5 text-slate-400" />
                  <span>{row.time}</span>
                </div>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "checked_in" ? "success" : "warning"}>
                  {row.status.replace("_", " ")}
                </Badge>
              )
            },
            {
              key: "actions",
              label: "Check-In Action",
              render: (row) => (
                row.status === "scheduled" ? (
                  <Button size="sm" onClick={() => handleCheckIn(row.id)}>
                    <UserCheck className="h-3.5 w-3.5" />
                    Check In
                  </Button>
                ) : (
                  <span className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                    <UserCheck className="h-3.5 w-3.5 text-emerald-500" /> Checked In
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
