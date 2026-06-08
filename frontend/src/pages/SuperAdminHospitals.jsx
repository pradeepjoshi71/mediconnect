import { Building2, Plus, Phone, Mail, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import hospitalService from "../services/hospitalService";
import { PageHeader } from "../components/ui/PageHeader";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export default function SuperAdminHospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hospitalService.listHospitals()
      .then((data) => {
        setHospitals(data.hospitals || []);
      })
      .catch((err) => {
        toast.error("Failed to load hospitals data");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Multi-Tenant Management"
        title="Hospital Tenant Directory"
        description="Monitor network nodes, configure slug mapping, verify status, and fetch support metadata."
        actions={
          <Button onClick={() => toast.success("New hospital provisioning is managed via environment setup setup-mediconnect-frontend.sh.")}>
            <Plus className="h-4 w-4" />
            Provision Hospital
          </Button>
        }
      />

      <div className="rounded-[28px] border border-slate-200/50 bg-white/85 p-6 shadow-premium backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center">
            <div className="text-sm font-semibold text-slate-500 animate-pulse-subtle">
              Loading hospital directory...
            </div>
          </div>
        ) : (
          <PaginatedTable
            rows={hospitals}
            pageSize={10}
            emptyState={
              <EmptyState
                title="No hospitals registered"
                description="Use SQL migrations or seeders to add hospital tenants."
              />
            }
            columns={[
              { key: "name", label: "Hospital Name" },
              {
                key: "code",
                label: "Code",
                render: (row) => (
                  <span className="rounded bg-slate-200/60 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400 uppercase tracking-wider">
                    {row.code}
                  </span>
                )
              },
              { key: "slug", label: "Subdomain Slug" },
              {
                key: "support_phone",
                label: "Support Phone",
                render: (row) => (
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span>{row.support_phone || "N/A"}</span>
                  </div>
                )
              },
              {
                key: "billing_email",
                label: "Billing Email",
                render: (row) => (
                  <div className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{row.billing_email || "N/A"}</span>
                  </div>
                )
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={row.status === "active" ? "success" : "slate"}>
                    {row.status}
                  </Badge>
                ),
              },
            ]}
          />
        )}
      </div>
    </div>
  );
}
