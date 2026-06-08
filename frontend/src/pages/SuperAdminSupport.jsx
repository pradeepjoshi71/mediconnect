import { LifeBuoy, AlertCircle, Clock, ShieldCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";

export default function SuperAdminSupport() {
  const tickets = [
    { id: 101, tenant: "MediConnect Bengaluru Hospital", subject: "Stripe webhook failure in production environment", priority: "high", status: "open", date: "2026-06-07 15:42" },
    { id: 102, tenant: "MediConnect Mumbai Clinic Network", subject: "Inability to load radiology PDFs", priority: "medium", status: "investigating", date: "2026-06-07 11:20" },
    { id: 103, tenant: "MediConnect Pradeep Hospital", subject: "Custom domain SSL certificate renewal request", priority: "low", status: "resolved", date: "2026-06-06 09:05" }
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Customer Success"
        title="Hospital Support Console"
        description="Respond to technical queries, coordinate environment bugs, and manage critical service escalations."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={AlertCircle}
          label="Open Issues"
          value="1"
          helper="High priority incident active"
          accent="brand"
        />
        <StatCard
          icon={Clock}
          label="Avg Response Time"
          value="14 min"
          helper="Well within SLA threshold"
          accent="teal"
        />
        <StatCard
          icon={ShieldCheck}
          label="Satisifaction Score"
          value="4.9 / 5"
          helper="Feedback based on closed tickets"
          accent="success"
        />
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        <h2 className="mb-4 text-base font-bold tracking-tight text-slate-900 dark:text-white">
          Active Support Tickets
        </h2>
        <PaginatedTable
          rows={tickets}
          pageSize={5}
          emptyState={
            <EmptyState
              title="All clear"
              description="No outstanding support tickets are reported."
            />
          }
          columns={[
            { key: "id", label: "Ticket ID" },
            { key: "tenant", label: "Tenant Node" },
            { key: "subject", label: "Issue Subject" },
            {
              key: "priority",
              label: "Priority",
              render: (row) => (
                <Badge tone={row.priority === "high" ? "danger" : row.priority === "medium" ? "warning" : "success"}>
                  {row.priority}
                </Badge>
              )
            },
            {
              key: "status",
              label: "Status",
              render: (row) => (
                <Badge tone={row.status === "open" ? "danger" : row.status === "investigating" ? "warning" : "success"}>
                  {row.status}
                </Badge>
              )
            },
            { key: "date", label: "Created At" }
          ]}
        />
      </div>
    </div>
  );
}
