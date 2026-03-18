import { CalendarDays, CreditCard, FileText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDashboard } from "../services/dashboardService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

export default function PatientDashboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => toast.error("Unable to load patient dashboard"));
  }, []);

  const stats = data?.stats || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Patient portal"
        title="Your care journey in one place"
        description="Track upcoming visits, medical history, billing, and every touchpoint in your hospital timeline."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          label="Upcoming appointments"
          value={stats.upcomingAppointments || 0}
          helper="Scheduled or confirmed visits"
        />
        <StatCard
          icon={FileText}
          label="Medical records"
          value={stats.medicalRecords || 0}
          helper="Documented consultations and prescriptions"
          accent="teal"
        />
        <StatCard
          icon={CreditCard}
          label="Outstanding invoices"
          value={stats.outstandingInvoices || 0}
          helper="Pending or processing payments"
          accent="amber"
        />
        <StatCard
          icon={Sparkles}
          label="Timeline events"
          value={data?.timeline?.length || 0}
          helper="Recent care activity"
        />
      </div>

      <PaginatedTable
        rows={data?.appointments || []}
        emptyState={
          <EmptyState
            title="No appointments yet"
            description="Book your first consultation from the appointments page."
          />
        }
        columns={[
          { key: "doctorName", label: "Doctor" },
          { key: "specialization", label: "Specialty" },
          {
            key: "scheduledStart",
            label: "When",
            render: (row) => formatDateTime(row.scheduledStart),
          },
          {
            key: "status",
            label: "Status",
            render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge>,
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Medical activity timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.timeline?.length ? (
              data.timeline.map((item) => (
                <div
                  key={`${item.type}-${item.entityId}`}
                  className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={statusTone(item.status)}>{item.type.replace("_", " ")}</Badge>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(item.occurredAt)}
                    </div>
                  </div>
                  <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">
                    {item.summary || "Clinical update"}
                  </div>
                  <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {item.actor}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No timeline events"
                description="Your visit and report history will appear here."
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Billing snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data?.payments?.length ? (
              data.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      {payment.invoiceNumber}
                    </div>
                    <Badge tone={statusTone(payment.status)}>{payment.status}</Badge>
                  </div>
                  <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {payment.doctorName || "Care team invoice"}
                  </div>
                  <div className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-white">
                    {formatCurrency(payment.amountCents, payment.currency)}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No invoices yet"
                description="Payments and invoices will appear after appointments are booked."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
