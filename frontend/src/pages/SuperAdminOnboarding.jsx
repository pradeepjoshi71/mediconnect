import { Search, UserCheck, UserX, Building2, ClipboardList, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import hospitalService from "../services/hospitalService";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { EmptyState } from "../components/ui/EmptyState";
import { formatDateTime } from "../utils/formatters";

export default function SuperAdminOnboarding() {
  const [applications, setApplications] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await hospitalService.getApplications(query);
      setApplications(data.applications || []);
    } catch {
      toast.error("Failed to load onboarding applications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [query]);

  const handleApprove = async (id) => {
    const loader = toast.loading("Provisioning hospital tenant and admin account...");
    try {
      const res = await hospitalService.approveApplication(id);
      toast.success(
        <div>
          <strong>Tenant provisioned!</strong>
          <br />Code: <code>{res.code}</code>
          <br />Admin Email: <code>{res.email}</code>
        </div>,
        { duration: 6000 }
      );
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to approve application");
    } finally {
      toast.dismiss(loader);
    }
  };

  const handleReject = async (id) => {
    try {
      await hospitalService.rejectApplication(id);
      toast.success("Application rejected successfully");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to reject application");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Onboarding Operations"
        title="Hospital Onboarding Applications"
        description="Verify submitted registration requests, provision secure multi-tenant hospital configurations, and reject invalid requests."
      />

      <div className="flex items-center max-w-md">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-11"
            placeholder="Search by hospital name or contact..."
          />
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="text-sm font-semibold text-slate-500 animate-pulse-subtle">
              Loading applications...
            </div>
          </div>
        ) : (
          <PaginatedTable
            rows={applications}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No applications found"
                description="Clinic registration requests will appear here once submitted."
              />
            }
            columns={[
              { key: "hospitalName", label: "Hospital Name" },
              { key: "contactPerson", label: "Contact Person" },
              { key: "hospitalType", label: "Hospital Type" },
              { key: "numberOfDoctors", label: "Doctors" },
              { key: "email", label: "Email" },
              { key: "phone", label: "Phone" },
              { key: "createdAt", label: "Submitted", render: (row) => formatDateTime(row.createdAt) },
              {
                key: "status",
                label: "Status",
                render: (row) => {
                  let tone = "warning";
                  if (row.status === "approved") tone = "success";
                  if (row.status === "rejected") tone = "danger";
                  return <Badge tone={tone}>{row.status.toUpperCase()}</Badge>;
                }
              },
              {
                key: "actions",
                label: "Review Decisions",
                render: (row) => (
                  row.status === "pending" ? (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleApprove(row.id)}>
                        <UserCheck className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-500 hover:bg-red-50 border-red-200" onClick={() => handleReject(row.id)}>
                        <UserX className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 font-semibold uppercase italic">
                      Processed
                    </span>
                  )
                )
              }
            ]}
          />
        )}
      </div>
    </div>
  );
}
