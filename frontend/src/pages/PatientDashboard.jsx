import { AlertCircle, CalendarDays, CreditCard, FileText, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { getDashboard } from "../services/dashboardService";
import { runSymptomCheck } from "../services/intelligenceService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

const initialSymptomForm = {
  symptoms: "",
  careNeed: "",
  severity: "mild",
};

export default function PatientDashboard() {
  const [data, setData] = useState(null);
  const [symptomForm, setSymptomForm] = useState(initialSymptomForm);
  const [symptomResult, setSymptomResult] = useState(null);
  const [checkingSymptoms, setCheckingSymptoms] = useState(false);

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => toast.error("Unable to load patient dashboard"));
  }, []);

  async function submitSymptomCheck(event) {
    event.preventDefault();
    const symptoms = symptomForm.symptoms
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    if (!symptoms.length) {
      toast.error("Add at least one symptom to run triage");
      return;
    }

    setCheckingSymptoms(true);
    try {
      const result = await runSymptomCheck({
        symptoms,
        careNeed: symptomForm.careNeed || undefined,
        severity: symptomForm.severity,
      });
      setSymptomResult(result);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to run symptom triage");
    } finally {
      setCheckingSymptoms(false);
    }
  }

  const stats = data?.stats || {};

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={data?.hospital?.code ? `${data.hospital.code} patient portal` : "Patient portal"}
        title={data?.hospital?.name || "Your care journey in one place"}
        description="Track upcoming visits, medical history, billing, follow-up plans, and every touchpoint in your hospital timeline."
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
          label="Follow-up reminders"
          value={data?.followUps?.length || 0}
          helper="Due soon or overdue care plans"
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

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Follow-up care reminders</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {data?.followUps?.length ? (
                data.followUps.map((item) => (
                  <div
                    key={item.medicalRecordId}
                    className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {item.diagnosis}
                      </div>
                      <Badge tone={item.status === "overdue" ? "rose" : "amber"}>
                        {item.status === "overdue" ? "Overdue" : "Due soon"}
                      </Badge>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {item.doctorName} · {item.specialization}
                    </div>
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                      Follow-up target: {formatDateTime(item.followUpDueAt)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No follow-up reminders"
                  description="New follow-up plans from your doctor will appear here."
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI symptom checker</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={submitSymptomCheck} className="space-y-4">
                <textarea
                  rows={3}
                  value={symptomForm.symptoms}
                  onChange={(event) =>
                    setSymptomForm((current) => ({ ...current, symptoms: event.target.value }))
                  }
                  placeholder="Enter symptoms separated by commas, for example: chest pain, shortness of breath"
                  className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                />
                <input
                  value={symptomForm.careNeed}
                  onChange={(event) =>
                    setSymptomForm((current) => ({ ...current, careNeed: event.target.value }))
                  }
                  placeholder="Optional care need or context"
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/70 dark:border-slate-800 dark:bg-slate-950"
                />
                <select
                  value={symptomForm.severity}
                  onChange={(event) =>
                    setSymptomForm((current) => ({ ...current, severity: event.target.value }))
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <option value="mild">Mild symptoms</option>
                  <option value="moderate">Moderate symptoms</option>
                  <option value="severe">Severe symptoms</option>
                </select>
                <Button type="submit" loading={checkingSymptoms}>
                  Run symptom triage
                </Button>
              </form>

              {symptomResult ? (
                <div className="rounded-3xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      Triage guidance
                    </div>
                    <Badge tone={statusTone(symptomResult.triage)}>
                      {symptomResult.triage}
                    </Badge>
                  </div>
                  <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {symptomResult.summary}
                  </div>
                  {symptomResult.redFlags?.length ? (
                    <div className="mt-4 rounded-2xl bg-rose-50 p-4 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-200">
                      <div className="flex items-center gap-2 font-semibold">
                        <AlertCircle className="h-4 w-4" />
                        Red flags
                      </div>
                      <div className="mt-2">{symptomResult.redFlags.join(", ")}</div>
                    </div>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(symptomResult.recommendedSpecializations || []).map((item) => (
                      <Badge key={item} tone="brand">
                        {item}
                      </Badge>
                    ))}
                  </div>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    {symptomResult.disclaimer}
                  </div>
                </div>
              ) : null}
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
    </div>
  );
}
