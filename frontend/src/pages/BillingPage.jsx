import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  CreditCard,
  Download,
  Landmark,
  Receipt,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  XCircle,
  Clock,
  Sparkles,
  ChevronRight,
  User,
  History,
  DollarSign,
  Banknote,
  SmartphoneNfc,
  Wallet,
  Edit2,
  ArrowDownToLine
} from "lucide-react";
import { getUser } from "../services/session";
import {
  listInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  cancelInvoice,
  getRevenueReports,
  downloadInvoicePdf
} from "../services/invoiceService";
import {
  createOrder,
  verifyPayment,
  refundPayment,
  getHistory,
  recordOfflinePayment
} from "../services/paymentService";
import { listPatients } from "../services/patientService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { KpiCard } from "../components/ui/KpiCard";
import { Drawer } from "../components/ui/Drawer";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

// ─── Status badge helper ────────────────────────────────────────────────────

function statusLabel(status) {
  const map = {
    paid: "PAID",
    pending: "PENDING",
    partially_paid: "PARTIAL",
    draft: "DRAFT",
    cancelled: "CANCELLED",
    refunded: "REFUNDED"
  };
  return map[status] || status?.toUpperCase();
}

function extendedStatusTone(status) {
  if (status === "partially_paid") return "amber";
  return statusTone(status);
}

// ─── Offline payment method config ──────────────────────────────────────────

const OFFLINE_METHODS = [
  { id: "Cash", label: "Cash Payment", icon: Banknote },
  { id: "UPI", label: "UPI at Reception", icon: SmartphoneNfc },
  { id: "Card Machine", label: "Card Machine / POS", icon: CreditCard },
  { id: "Bank Transfer", label: "Bank Transfer / NEFT", icon: Landmark }
];

const ONLINE_METHODS = [
  { id: "UPI", label: "UPI (GPay / PhonePe / Paytm)", icon: Sparkles },
  { id: "Credit Card", label: "Credit Card", icon: CreditCard },
  { id: "Debit Card", label: "Debit Card", icon: Landmark },
  { id: "Net Banking", label: "Net Banking", icon: DollarSign },
  { id: "Wallet", label: "Mobile Wallet", icon: Wallet }
];

// ─── Main Component ──────────────────────────────────────────────────────────

export default function BillingPage() {
  const user = getUser();
  const isAdmin = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"].includes(user?.role);
  const isDoctor = user?.role === "doctor";

  const [activeTab, setActiveTab] = useState("invoices");

  // Data lists
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Dashboard metrics
  const [metrics, setMetrics] = useState({
    revenueToday: 0,
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    successfulPayments: 0,
    failedPayments: 0
  });

  // Invoice modal
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Online checkout modal
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Offline payment modal
  const [offlineInvoice, setOfflineInvoice] = useState(null);
  const [isOfflineOpen, setIsOfflineOpen] = useState(false);
  const [offlineMethod, setOfflineMethod] = useState("Cash");
  const [offlineAmount, setOfflineAmount] = useState("");
  const [offlineRef, setOfflineRef] = useState("");
  const [offlineNotes, setOfflineNotes] = useState("");
  const [offlineSubmitting, setOfflineSubmitting] = useState(false);

  // Payment history drawer
  const [historyDrawerInvoice, setHistoryDrawerInvoice] = useState(null);

  // Invoice form state
  const [formPatientId, setFormPatientId] = useState("");
  const [formTaxRate, setFormTaxRate] = useState(5);
  const [formDiscount, setFormDiscount] = useState(0);
  const [formItems, setFormItems] = useState([
    { itemType: "consultation", itemName: "General Consultation", quantity: 1, unitPrice: 50 }
  ]);

  // ─── Load Data ─────────────────────────────────────────────────────────────

  async function loadData() {
    setLoading(true);
    try {
      const filters = {};
      if (!isAdmin && !isDoctor) {
        filters.patientId = user?.patientProfileId;
      }

      const [invList, payHistory] = await Promise.all([
        listInvoices(filters),
        getHistory()
      ]);
      setInvoices(invList);
      setPayments(payHistory);

      if (isAdmin) {
        const [met, patList] = await Promise.all([
          getRevenueReports(),
          listPatients()
        ]);
        setMetrics(met);
        setPatients(patList);
      } else {
        const paid = payHistory
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const pending = invList
          .filter((i) => i.status === "pending" || i.status === "partially_paid")
          .reduce((sum, i) => sum + Number(i.balanceDue || i.totalAmount || 0), 0);
        setMetrics({
          revenueToday: 0,
          revenueThisMonth: paid,
          outstandingInvoices: pending,
          successfulPayments: payHistory.filter((p) => p.status === "paid").length,
          failedPayments: payHistory.filter((p) => p.status === "failed").length
        });
      }
    } catch (error) {
      toast.error("Failed to load billing information");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // ─── Invoice Form Helpers ──────────────────────────────────────────────────

  const formSubtotal = formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const formTaxAmount = Number(((formSubtotal * formTaxRate) / 100).toFixed(2));
  const formTotalAmount = Number((formSubtotal + formTaxAmount - Number(formDiscount)).toFixed(2));

  const handleAddItem = () => {
    setFormItems([...formItems, { itemType: "consultation", itemName: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveItem = (index) => {
    if (formItems.length === 1) return;
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const next = [...formItems];
    next[index][field] = value;
    setFormItems(next);
  };

  const handleOpenCreateModal = () => {
    setEditingInvoice(null);
    setFormPatientId(patients[0]?.id || "");
    setFormTaxRate(5);
    setFormDiscount(0);
    setFormItems([{ itemType: "consultation", itemName: "General Consultation", quantity: 1, unitPrice: 50.00 }]);
    setIsInvoiceModalOpen(true);
  };

  const handleOpenEditModal = (inv) => {
    setEditingInvoice(inv);
    setFormPatientId(inv.patientId);
    const taxPct = inv.subtotal > 0 ? Math.round((Number(inv.taxAmount) / Number(inv.subtotal)) * 100) : 0;
    setFormTaxRate(taxPct);
    setFormDiscount(Number(inv.discountAmount));
    setFormItems(inv.items.map(item => ({
      itemType: item.itemType,
      itemName: item.itemName,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice)
    })));
    setIsInvoiceModalOpen(true);
  };

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!formPatientId) {
      toast.error("Please select a patient");
      return;
    }

    const payload = {
      patientId: Number(formPatientId),
      subtotal: formSubtotal,
      taxAmount: formTaxAmount,
      discountAmount: Number(formDiscount),
      status: "pending",  // always start as pending — status derived from payments
      items: formItems.map(item => ({
        ...item,
        totalPrice: Number((item.quantity * item.unitPrice).toFixed(2))
      }))
    };

    try {
      if (editingInvoice) {
        await updateInvoice(editingInvoice.id, payload);
        toast.success("Invoice updated successfully");
      } else {
        await createInvoice(payload);
        toast.success("Invoice generated successfully");
      }
      setIsInvoiceModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save invoice");
    }
  };

  const handleCancelInvoice = async (id) => {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;
    try {
      await cancelInvoice(id);
      toast.success("Invoice cancelled successfully");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel invoice");
    }
  };

  const handleRefund = async (paymentId) => {
    const amountStr = prompt("Enter amount to refund (leave empty for full refund):");
    if (amountStr === null) return;

    try {
      const amount = amountStr ? Number(amountStr) : undefined;
      await refundPayment(paymentId, amount);
      toast.success("Refund processed successfully!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process refund");
    }
  };

  // ─── Online Payment (Razorpay) ─────────────────────────────────────────────

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayInvoice = (invoice) => {
    setCheckoutInvoice(invoice);
    setPaymentMethod("UPI");
    setIsCheckoutOpen(true);
  };

  const executePaymentCheckout = async () => {
    setIsCheckoutOpen(false);
    const invoice = checkoutInvoice;

    try {
      setLoading(true);

      const order = await createOrder(invoice.id, paymentMethod);
      const sdkLoaded = await loadRazorpayScript();

      // Sandbox mock if no real Razorpay keys configured
      if (!sdkLoaded || order.orderId.startsWith("order_mock_")) {
        toast.success("Sandbox checkout mode activated");

        const mockVerify = confirm(
          `[TEST SANDBOX]\n\nInvoice: ${invoice.invoiceNumber}\nBalance Due: INR ${Number(invoice.balanceDue ?? invoice.totalAmount).toFixed(2)}\nMethod: ${paymentMethod}\nMock Order: ${order.orderId}\n\nConfirm test payment?`
        );

        if (mockVerify) {
          await verifyPayment({
            razorpayOrderId: order.orderId,
            razorpayPaymentId: `pay_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            razorpaySignature: `sig_mock_${Math.random().toString(36).substring(2, 16)}`,
            invoiceId: invoice.id,
            paymentMethod
          });
          toast.success("Test Payment Verified Successfully!");
          loadData();
        } else {
          toast.error("Test payment cancelled");
        }
        return;
      }

      // Real Razorpay popup — supports UPI, Cards, Net Banking, Wallets
      const options = {
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "MediConnect Hospital",
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        order_id: order.orderId,
        prefill: {
          name: user.fullName || "Patient",
          email: user.email || ""
        },
        config: {
          display: {
            blocks: {
              upi_block: { name: "Pay via UPI", instruments: [{ method: "upi" }] },
              card_block: { name: "Pay via Card", instruments: [{ method: "card" }] },
              nb_block: { name: "Net Banking", instruments: [{ method: "netbanking" }] },
              wallet_block: { name: "Wallets", instruments: [{ method: "wallet" }] }
            },
            sequence: ["block.upi_block", "block.card_block", "block.nb_block", "block.wallet_block"],
            preferences: { show_default_blocks: false }
          }
        },
        theme: { color: "#6366f1" },
        handler: async function (response) {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              invoiceId: invoice.id,
              paymentMethod
            });
            toast.success("Payment verified successfully!");
            loadData();
          } catch (err) {
            toast.error("Payment verification failed: " + (err.response?.data?.message || err.message));
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", function (response) {
        toast.error(`Transaction failed: ${response.error.description}`);
      });
      rzp.open();

    } catch (err) {
      toast.error(err.response?.data?.message || "Checkout creation failed");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Offline Payment ──────────────────────────────────────────────────────

  const handleOpenOfflineModal = (invoice) => {
    setOfflineInvoice(invoice);
    setOfflineMethod("Cash");
    setOfflineAmount(Number(invoice.balanceDue ?? invoice.totalAmount).toFixed(2));
    setOfflineRef("");
    setOfflineNotes("");
    setIsOfflineOpen(true);
  };

  const handleSubmitOfflinePayment = async (e) => {
    e.preventDefault();
    if (!offlineAmount || Number(offlineAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    setOfflineSubmitting(true);
    try {
      const result = await recordOfflinePayment({
        invoiceId: offlineInvoice.id,
        amount: Number(offlineAmount),
        paymentMethod: offlineMethod,
        referenceNumber: offlineRef || undefined,
        notes: offlineNotes || undefined
      });

      const newStatus = result.invoiceStatus;
      const statusMsg = newStatus === "paid" ? "Invoice fully settled!" :
                        newStatus === "partially_paid" ? "Partial payment recorded — balance remaining." :
                        "Payment recorded.";
      toast.success(`Offline payment recorded. ${statusMsg}`);
      setIsOfflineOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to record offline payment");
    } finally {
      setOfflineSubmitting(false);
    }
  };

  // ─── PDF Download ─────────────────────────────────────────────────────────

  const handleDownloadInvoice = async (invoiceId) => {
    try {
      toast.loading("Generating Invoice PDF...", { id: "pdf" });
      await downloadInvoicePdf(invoiceId);
      toast.success("PDF Downloaded!", { id: "pdf" });
    } catch (err) {
      toast.error("Failed to generate PDF invoice", { id: "pdf" });
    }
  };

  // ─── Determine if an invoice can accept more payments ─────────────────────

  const canPay = (inv) =>
    (inv.status === "pending" || inv.status === "partially_paid" || inv.status === "draft") &&
    Number(inv.balanceDue ?? inv.totalAmount) > 0;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Financial Dashboard"
        title="Hospital Billing & Payment Management"
        description="Comprehensive invoice tracking, itemized medical billing workflows, secure online Razorpay payments, and offline cash/UPI recording."
      />

      {/* Dashboard Metrics */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <>
            <KpiCard
              icon={Landmark}
              label="Revenue Today"
              value={formatCurrency(metrics.revenueToday * 100)}
              trend={{ value: "Daily Live", isPositive: true }}
              description="payments collected today"
              accent="teal"
            />
            <KpiCard
              icon={DollarSign}
              label="Revenue This Month"
              value={formatCurrency(metrics.revenueThisMonth * 100)}
              trend={{ value: "Monthly", isPositive: true }}
              description="cumulative monthly total"
              accent="brand"
            />
          </>
        )}
        {!isAdmin && (
          <KpiCard
            icon={Landmark}
            label="Paid to Date"
            value={formatCurrency(metrics.revenueThisMonth * 100)}
            trend={{ value: "Settled", isPositive: true }}
            description="your settled invoices total"
            accent="teal"
          />
        )}
        <KpiCard
          icon={CreditCard}
          label="Outstanding Balance"
          value={formatCurrency(metrics.outstandingInvoices * 100)}
          trend={{ value: "Pending Due", isPositive: false }}
          description="payments awaiting settlement"
          accent="amber"
        />
        <KpiCard
          icon={Receipt}
          label="Completed Payments"
          value={metrics.successfulPayments}
          trend={{ value: `${metrics.failedPayments} failed`, isPositive: metrics.failedPayments === 0 }}
          description="successful transaction history"
          accent="success"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "invoices"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Receipt className="h-4 w-4" />
          Invoices
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "payments"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <History className="h-4 w-4" />
          Payment Transactions
        </button>
      </div>

      {/* Tab: Invoices */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAdmin ? "Manage Invoices" : "My Invoices"}
            </h3>
            {isAdmin && (
              <Button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg"
              >
                <Plus className="h-4 w-4" /> Generate Invoice
              </Button>
            )}
          </div>

          <PaginatedTable
            rows={invoices}
            emptyState={
              <EmptyState
                title="No invoices found"
                description={isAdmin ? "Click 'Generate Invoice' to register patient billings." : "You have no outstanding or past invoices."}
              />
            }
            columns={[
              {
                key: "invoiceNumber",
                label: "Invoice ID",
                render: (row) => <span className="font-mono font-bold text-xs tracking-tight text-slate-800 dark:text-slate-200">{row.invoiceNumber}</span>
              },
              { key: "patientName", label: "Patient" },
              {
                key: "doctorName",
                label: "Care Team",
                render: (row) => row.doctorName || "General Staff"
              },
              {
                key: "totalAmount",
                label: "Total Bill",
                render: (row) => (
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatCurrency(row.amountCents)}
                  </span>
                )
              },
              {
                key: "paidAmount",
                label: "Amount Paid",
                render: (row) => (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    {formatCurrency(Math.round(Number(row.paidAmount || 0) * 100))}
                  </span>
                )
              },
              {
                key: "balanceDue",
                label: "Balance Due",
                render: (row) => {
                  const due = Number(row.balanceDue ?? row.totalAmount);
                  return due > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-xs">
                      {formatCurrency(Math.round(due * 100))}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs font-semibold">—</span>
                  );
                }
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={extendedStatusTone(row.status)}>
                    {statusLabel(row.status)}
                  </Badge>
                )
              },
              {
                key: "createdAt",
                label: "Date",
                render: (row) => formatDateTime(row.createdAt)
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Pay Online / Pay Now placeholder */}
                    {canPay(row) && (
                      <Button
                        size="sm"
                        className="bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-[10px] px-3 py-1 font-bold shadow-soft transition-all"
                        onClick={() => handlePayInvoice(row)}
                        title="Pay Now"
                      >
                        Pay Now
                      </Button>
                    )}

                    {/* Record Payment placeholder — admins only */}
                    {isAdmin && canPay(row) && (
                      <Button
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] px-3 py-1 font-bold shadow-soft transition-all"
                        onClick={() => handleOpenOfflineModal(row)}
                        title="Record Payment"
                      >
                        Record Payment
                      </Button>
                    )}

                    {/* PDF download */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownloadInvoice(row.id)}
                      title="Download PDF"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>

                    {/* Transaction History Drawer */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setHistoryDrawerInvoice(row)}
                      title="Payment History"
                      className="rounded-xl px-2.5"
                    >
                      <History className="h-3.5 w-3.5" />
                    </Button>

                    {/* Edit — admins, only for non-paid invoices */}
                    {isAdmin && row.status !== "paid" && row.status !== "cancelled" && row.status !== "refunded" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleOpenEditModal(row)}
                        title="Edit invoice items"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    )}

                    {/* Cancel — admins, only for unpaid invoices */}
                    {isAdmin && row.status !== "paid" && row.status !== "cancelled" && row.status !== "refunded" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl"
                        onClick={() => handleCancelInvoice(row.id)}
                        title="Cancel invoice"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Tab: Payment Transactions */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAdmin ? "Global Payment History" : "My Payment History"}
            </h3>
          </div>

          <PaginatedTable
            rows={payments}
            emptyState={
              <EmptyState
                title="No transactions yet"
                description="Completed transactions appear here automatically."
              />
            }
            columns={[
              {
                key: "transactionId",
                label: "Transaction Ref",
                render: (row) => (
                  <span className="font-mono text-xs">{row.transactionId || row.referenceNumber || "—"}</span>
                )
              },
              { key: "invoiceNumber", label: "Invoice" },
              { key: "patientName", label: "Patient" },
              {
                key: "source",
                label: "Source",
                render: (row) => (
                  <Badge tone={row.source === "offline" ? "amber" : "brand"}>
                    {row.source === "offline" ? "OFFLINE" : "ONLINE"}
                  </Badge>
                )
              },
              { key: "paymentMethodLabel", label: "Method" },
              {
                key: "amount",
                label: "Amount",
                render: (row) => formatCurrency(row.amountCents)
              },
              {
                key: "status",
                label: "Status",
                render: (row) => (
                  <Badge tone={statusTone(row.status)}>{row.status.toUpperCase()}</Badge>
                )
              },
              {
                key: "paidAt",
                label: "Settled",
                render: (row) => formatDateTime(row.paidAt)
              },
              {
                key: "actions",
                label: "Actions",
                render: (row) => (
                  <div>
                    {isAdmin && row.status === "paid" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-rose-200 text-rose-600 hover:bg-rose-50"
                        onClick={() => handleRefund(row.id)}
                      >
                        Refund
                      </Button>
                    )}
                    {!isAdmin && (
                      <span className="text-slate-400 text-xs italic">
                        {row.status === "paid" ? "✓ Verified" : row.status}
                      </span>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* ── Invoice Create/Edit Modal ───────────────────────────────────────── */}
      <Modal
        open={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={editingInvoice ? `Modify Invoice — ${editingInvoice.invoiceNumber}` : "Generate New Invoice"}
      >
        <form onSubmit={handleSaveInvoice} className="space-y-6">
          {/* Patient selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Select Patient
            </label>
            <select
              value={formPatientId}
              onChange={(e) => setFormPatientId(e.target.value)}
              disabled={!!editingInvoice}
              className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
            >
              {patients.map((pat) => (
                <option key={pat.id} value={pat.id}>
                  {pat.fullName} ({pat.medicalRecordNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <div className="space-y-3.5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Line Items & Services</h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                <Plus className="h-4 w-4" /> Add Row
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {formItems.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <select
                    value={item.itemType}
                    onChange={(e) => handleItemChange(index, "itemType", e.target.value)}
                    className="w-36 h-10 px-2 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 text-xs focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="consultation">Consultation</option>
                    <option value="laboratory">Laboratory</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="procedure">Procedure</option>
                    <option value="admission">Admission</option>
                  </select>

                  <Input
                    placeholder="Service name"
                    value={item.itemName}
                    onChange={(e) => handleItemChange(index, "itemName", e.target.value)}
                    className="h-10 text-xs"
                    required
                  />

                  <Input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", Number(e.target.value))}
                    className="w-20 h-10 text-xs"
                    min="1"
                    required
                  />

                  <Input
                    type="number"
                    placeholder="Unit Price"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, "unitPrice", Number(e.target.value))}
                    className="w-28 h-10 text-xs"
                    min="0"
                    step="0.01"
                    required
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveItem(index)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing summary */}
          <div className="grid gap-4 md:grid-cols-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tax Rate (%)</label>
              <Input
                type="number"
                value={formTaxRate}
                onChange={(e) => setFormTaxRate(Number(e.target.value))}
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Discount (INR)</label>
              <Input
                type="number"
                value={formDiscount}
                onChange={(e) => setFormDiscount(Number(e.target.value))}
                min="0"
                step="0.01"
              />
            </div>
            <div className="flex flex-col justify-end items-end p-2 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 font-semibold">Grand Total:</span>
              <span className="text-xl font-black text-slate-900 dark:text-white">
                INR {formTotalAmount.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400">
                Sub: {formSubtotal.toFixed(2)} + Tax: {formTaxAmount.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2.5">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              <strong>Note:</strong> Invoice status is automatically calculated from payments.
              Use "Pay Online" or "Record Payment" to settle this invoice.
            </p>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsInvoiceModalOpen(false)}>
              Discard
            </Button>
            <Button type="submit" className="bg-brand-600 hover:bg-brand-700 text-white rounded-2xl">
              Save & Generate Invoice
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Online Checkout Modal ──────────────────────────────────────────── */}
      <Modal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Online Payment — Razorpay Checkout"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Invoice</div>
              <div className="text-lg font-mono font-bold text-slate-950 dark:text-white">
                {checkoutInvoice?.invoiceNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold uppercase">Balance Due</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {checkoutInvoice && formatCurrency(
                  Math.round(Number(checkoutInvoice.balanceDue ?? checkoutInvoice.totalAmount) * 100)
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              {ONLINE_METHODS.map((method) => {
                const Icon = method.icon;
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                      active
                        ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${active ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{method.id}</div>
                      <div className="text-xs text-slate-400">{method.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>Cancel</Button>
            <Button
              onClick={executePaymentCheckout}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl shadow-lg"
            >
              Proceed to Checkout
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Offline Payment Modal ──────────────────────────────────────────── */}
      <Modal
        open={isOfflineOpen}
        onClose={() => setIsOfflineOpen(false)}
        title="Record Offline Payment"
      >
        <form onSubmit={handleSubmitOfflinePayment} className="space-y-5">
          {/* Invoice summary */}
          {offlineInvoice && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 flex justify-between">
              <div>
                <div className="text-xs text-emerald-600 font-bold uppercase tracking-wide">Invoice</div>
                <div className="font-mono font-bold text-slate-900 dark:text-white">{offlineInvoice.invoiceNumber}</div>
                <div className="text-xs text-slate-500">{offlineInvoice.patientName}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Balance Due</div>
                <div className="text-lg font-black text-rose-600 dark:text-rose-400">
                  {formatCurrency(Math.round(Number(offlineInvoice.balanceDue ?? offlineInvoice.totalAmount) * 100))}
                </div>
              </div>
            </div>
          )}

          {/* Payment method selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {OFFLINE_METHODS.map((method) => {
                const Icon = method.icon;
                const active = offlineMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setOfflineMethod(method.id)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                      active
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className={`p-1.5 rounded-lg ${active ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold">{method.id}</div>
                      <div className="text-xs text-slate-400 leading-tight">{method.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Amount field */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Amount Received (INR) <span className="text-rose-500">*</span>
            </label>
            <Input
              type="number"
              value={offlineAmount}
              onChange={(e) => setOfflineAmount(e.target.value)}
              min="0.01"
              step="0.01"
              max={Number(offlineInvoice?.balanceDue ?? offlineInvoice?.totalAmount ?? 999999)}
              required
              placeholder="Enter amount received"
            />
            <p className="text-xs text-slate-400 mt-1">
              Partial payments are accepted — invoice will show as PARTIALLY PAID until fully settled.
            </p>
          </div>

          {/* Reference number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Reference / Receipt Number <span className="text-slate-400">(Optional)</span>
            </label>
            <Input
              type="text"
              value={offlineRef}
              onChange={(e) => setOfflineRef(e.target.value)}
              placeholder="e.g. UPI Ref: 1234567890, Cash Receipt #123"
              maxLength={255}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Notes <span className="text-slate-400">(Optional)</span>
            </label>
            <textarea
              value={offlineNotes}
              onChange={(e) => setOfflineNotes(e.target.value)}
              rows={2}
              placeholder="Any additional payment notes..."
              maxLength={1000}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <Button type="button" variant="outline" onClick={() => setIsOfflineOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={offlineSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg"
            >
              {offlineSubmitting ? "Recording..." : "Record Payment"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Payment History Drawer ────────────────────────────────────────── */}
      <Drawer
        open={Boolean(historyDrawerInvoice)}
        onClose={() => setHistoryDrawerInvoice(null)}
        title={`Invoice Payment History — ${historyDrawerInvoice?.invoiceNumber}`}
        size="max-w-lg"
      >
        <div className="space-y-6">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-800 border border-slate-100 dark:border-neutral-200/10 flex justify-between items-center">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Total Billed</div>
              <div className="text-lg font-bold text-slate-900 dark:text-white">
                {historyDrawerInvoice && formatCurrency(historyDrawerInvoice.amountCents)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold uppercase">Settled</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {historyDrawerInvoice && formatCurrency(Math.round(Number(historyDrawerInvoice.paidAmount || 0) * 100))}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Transactions</h4>
            {payments.filter(p => p.invoiceNumber === historyDrawerInvoice?.invoiceNumber).length ? (
              payments
                .filter(p => p.invoiceNumber === historyDrawerInvoice?.invoiceNumber)
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="p-4 rounded-xl border border-slate-100 dark:border-neutral-200/10 bg-white/50 dark:bg-neutral-100/30 flex flex-col gap-2.5 transition-all duration-200 hover:border-slate-200 dark:hover:border-neutral-200/20"
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-xs font-semibold text-slate-900 dark:text-white">
                        {payment.transactionId || payment.referenceNumber || "Offline Receipt"}
                      </div>
                      <Badge tone={statusTone(payment.status)} className="text-[10px]">
                        {payment.status.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-neutral-400">
                      <div>
                        {payment.paymentMethodLabel} · <span className="capitalize">{payment.source}</span>
                      </div>
                      <div className="font-bold text-slate-700 dark:text-slate-200">
                        {formatCurrency(payment.amountCents)}
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 text-right">
                      {formatDateTime(payment.paidAt)}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center p-8 rounded-xl border border-dashed border-slate-200 dark:border-neutral-800 text-xs text-slate-400 dark:text-neutral-500">
                No payments recorded for this invoice yet.
              </div>
            )}
          </div>
        </div>
      </Drawer>
    </div>
  );
}
