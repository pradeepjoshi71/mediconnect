import { CreditCard, Download, Landmark, Receipt } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  listPayments,
  createCheckout,
  updatePaymentStatus,
  downloadInvoicePdf,
} from "../services/paymentService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

export default function BillingPage() {
  const [payments, setPayments] = useState([]);

  async function load() {
    try {
      setPayments(await listPayments());
    } catch {
      toast.error("Unable to load billing data");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const paidTotal = payments
    .filter((payment) => payment.status === "paid")
    .reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0);
  const pendingTotal = payments
    .filter((payment) => ["pending", "processing"].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amountCents || 0), 0);

  async function handleCheckout(paymentId, provider) {
    try {
      const result = await createCheckout(paymentId, provider);
      toast.success("Checkout placeholder created");
      window.open(result.checkoutUrl, "_blank", "noopener,noreferrer");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create checkout");
    }
  }

  async function markPaid(paymentId) {
    try {
      await updatePaymentStatus(paymentId, "paid");
      toast.success("Payment marked as paid");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update payment");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Billing"
        title="Invoices, payments, and financial follow-up"
        description="Track appointment charges, create placeholder gateway checkout links, and download invoice PDFs."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Receipt} label="Invoices" value={payments.length} helper="Total generated invoices" />
        <StatCard icon={Landmark} label="Paid revenue" value={formatCurrency(paidTotal)} helper="Collected payments" accent="teal" />
        <StatCard icon={CreditCard} label="Outstanding" value={formatCurrency(pendingTotal)} helper="Pending collection" accent="amber" />
        <StatCard icon={Download} label="Ready to export" value={payments.length} helper="Invoices available as PDF" />
      </div>

      <PaginatedTable
        rows={payments}
        emptyState={<EmptyState title="No billing records yet" description="Invoices are generated automatically after appointments are booked." />}
        columns={[
          { key: "invoiceNumber", label: "Invoice" },
          { key: "patientName", label: "Patient" },
          { key: "doctorName", label: "Doctor" },
          { key: "amountCents", label: "Amount", render: (row) => formatCurrency(row.amountCents, row.currency) },
          { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
          { key: "createdAt", label: "Created", render: (row) => formatDateTime(row.createdAt) },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => handleCheckout(row.id, "stripe")}>
                  Stripe
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleCheckout(row.id, "razorpay")}>
                  Razorpay
                </Button>
                <Button size="sm" variant="secondary" onClick={() => markPaid(row.id)}>
                  Mark paid
                </Button>
                <button
                  type="button"
                  onClick={() => downloadInvoicePdf(row.id)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
                >
                  PDF
                </button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
