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
  DollarSign
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
  getHistory
} from "../services/paymentService";
import { listPatients } from "../services/patientService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { PaginatedTable } from "../components/ui/PaginatedTable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { formatCurrency, formatDateTime, statusTone } from "../utils/formatters";

export default function BillingPage() {
  const user = getUser();
  const isAdmin = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"].includes(user?.role);
  const isDoctor = user?.role === "doctor";

  // Navigation tabs
  const [activeTab, setActiveTab] = useState("invoices");

  // State lists
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);

  // Stats / Dashboard Reports
  const [metrics, setMetrics] = useState({
    revenueToday: 0,
    revenueThisMonth: 0,
    outstandingInvoices: 0,
    successfulPayments: 0,
    failedPayments: 0
  });

  // Modal control
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);

  // Checkout modal
  const [checkoutInvoice, setCheckoutInvoice] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Form State
  const [formPatientId, setFormPatientId] = useState("");
  const [formStatus, setFormStatus] = useState("pending");
  const [formTaxRate, setFormTaxRate] = useState(5); // in percent
  const [formDiscount, setFormDiscount] = useState(0); // in absolute currency
  const [formItems, setFormItems] = useState([
    { itemType: "consultation", itemName: "General Consultation", quantity: 1, unitPrice: 50 }
  ]);

  // Load standard data
  async function loadData() {
    setLoading(true);
    try {
      const filters = {};
      if (!isAdmin && !isDoctor) {
        // Enforce listing patient's own invoices
        filters.patientId = user?.patientProfileId;
      }
      
      const invList = await listInvoices(filters);
      setInvoices(invList);

      const payHistory = await getHistory();
      setPayments(payHistory);

      if (isAdmin) {
        const met = await getRevenueReports();
        setMetrics(met);
        
        const patList = await listPatients();
        setPatients(patList);
      } else {
        // Compute patient stats locally for a personalized portal dashboard
        const paid = payHistory
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + Number(p.amount || 0), 0);
        
        const pending = invList
          .filter((i) => i.status === "pending")
          .reduce((sum, i) => sum + Number(i.totalAmount || 0), 0);
        
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

  // Form Totals
  const formSubtotal = formItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const formTaxAmount = Number(((formSubtotal * formTaxRate) / 100).toFixed(2));
  const formTotalAmount = Number((formSubtotal + formTaxAmount - Number(formDiscount)).toFixed(2));

  // Items handling
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

  // Open creation modal
  const handleOpenCreateModal = () => {
    setEditingInvoice(null);
    setFormPatientId(patients[0]?.id || "");
    setFormStatus("pending");
    setFormTaxRate(5);
    setFormDiscount(0);
    setFormItems([{ itemType: "consultation", itemName: "General Consultation", quantity: 1, unitPrice: 50.00 }]);
    setIsInvoiceModalOpen(true);
  };

  // Open edit modal
  const handleOpenEditModal = (inv) => {
    setEditingInvoice(inv);
    setFormPatientId(inv.patientId);
    setFormStatus(inv.status);
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

  // Submit invoice form
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
      status: formStatus,
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

  // Cancel invoice
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

  // Issue Refund
  const handleRefund = async (paymentId) => {
    const amountStr = prompt("Enter amount to refund (leave empty for full refund):");
    if (amountStr === null) return; // cancelled
    
    try {
      const amount = amountStr ? Number(amountStr) : undefined;
      await refundPayment(paymentId, amount);
      toast.success("Refund processed successfully!");
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to process refund");
    }
  };

  // Dynamically load Razorpay SDK
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Pay Invoice Flow
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
      
      // 1. Create order on backend
      const order = await createOrder(invoice.id, paymentMethod);
      
      // 2. Load SDK script
      const sdkLoaded = await loadRazorpayScript();
      
      // Fallback sandbox simulation if Razorpay cannot load or keys are not configured
      if (!sdkLoaded || order.orderId.startsWith("order_mock_")) {
        toast.success("Sandbox checkout mode activated (Razorpay test key/offline fallback)");
        
        // Show local mock payment checkout dialog immediately
        const mockVerify = confirm(
          `[TESTING SANDBOX]\n\nInvoice Amount: INR ${invoice.totalAmount}\nPayment Method: ${paymentMethod}\nMock Razorpay Order: ${order.orderId}\n\nConfirm test payment authorization?`
        );

        if (mockVerify) {
          await verifyPayment({
            razorpayOrderId: order.orderId,
            razorpayPaymentId: `pay_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
            razorpaySignature: `sig_mock_${Math.random().toString(36).substring(2, 16)}`,
            invoiceId: invoice.id,
            paymentMethod: paymentMethod
          });
          toast.success("Test Payment Verified Successfully!");
          loadData();
        } else {
          toast.error("Test payment cancelled by customer");
        }
        return;
      }

      // Real Razorpay integration popup
      const options = {
        key: order.razorpayKeyId,
        amount: order.amount,
        currency: order.currency,
        name: "MediConnect Hospital",
        description: `Payment for Invoice ${invoice.invoiceNumber}`,
        order_id: order.orderId,
        prefill: {
          name: user.full_name || "Patient",
          email: user.email || ""
        },
        theme: {
          color: "#0f172a"
        },
        handler: async function (response) {
          try {
            await verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              invoiceId: invoice.id,
              paymentMethod: paymentMethod
            });
            toast.success("Online payment verified successfully!");
            loadData();
          } catch (err) {
            toast.error("Online payment verification failed: " + (err.response?.data?.message || err.message));
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

  const handleDownloadInvoice = async (invoiceId) => {
    try {
      toast.loading("Generating Invoice PDF...", { id: "pdf" });
      await downloadInvoicePdf(invoiceId);
      toast.success("PDF Downloaded!", { id: "pdf" });
    } catch (err) {
      toast.error("Failed to compile PDF invoice", { id: "pdf" });
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Financial Dashboard"
        title="Hospital Billing & Payment Management"
        description="Comprehensive invoice tracking, itemized medical billing workflows, and secure online Razorpay payment processing."
      />

      {/* Modern Dashboard Metrics Panel */}
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {isAdmin && (
          <>
            <StatCard
              icon={Landmark}
              label="Revenue Today"
              value={formatCurrency(metrics.revenueToday * 100)}
              helper="Daily collected payments"
              accent="teal"
            />
            <StatCard
              icon={DollarSign}
              label="Revenue This Month"
              value={formatCurrency(metrics.revenueThisMonth * 100)}
              helper="Monthly cumulative total"
              accent="brand"
            />
          </>
        )}
        {!isAdmin && (
          <StatCard
            icon={Landmark}
            label="Paid to Date"
            value={formatCurrency(metrics.revenueThisMonth * 100)}
            helper="Your settled invoices total"
            accent="teal"
          />
        )}
        <StatCard
          icon={CreditCard}
          label="Outstanding Balance"
          value={formatCurrency(metrics.outstandingInvoices * 100)}
          helper="Due payments awaiting settlement"
          accent="amber"
        />
        <StatCard
          icon={Receipt}
          label="Completed Payments"
          value={metrics.successfulPayments}
          helper={`Failed transactions: ${metrics.failedPayments}`}
          accent="teal"
        />
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 transition-all ${
            activeTab === "invoices"
              ? "border-brand-500 text-brand-600 dark:text-brand-400"
              : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          <Receipt className="h-4.5 w-4.5" />
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
          <History className="h-4.5 w-4.5" />
          Payment Transactions
        </button>
      </div>

      {/* Tab Contents: Invoices */}
      {activeTab === "invoices" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAdmin ? "Manage Invoices" : "My Invoices"}
            </h3>
            {isAdmin && (
              <Button onClick={handleOpenCreateModal} className="flex items-center gap-2 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white shadow-lg">
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
              { key: "invoiceNumber", label: "Invoice ID", render: (row) => <span className="font-mono font-semibold">{row.invoiceNumber}</span> },
              { key: "patientName", label: "Patient" },
              { key: "doctorName", label: "Care Team", render: (row) => row.doctorName || "General Staff" },
              { key: "totalAmount", label: "Total Bill", render: (row) => <span className="font-semibold text-slate-950 dark:text-white">{formatCurrency(row.amountCents)}</span> },
              { key: "status", label: "Billing Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status.toUpperCase()}</Badge> },
              { key: "createdAt", label: "Date Created", render: (row) => formatDateTime(row.createdAt) },
              {
                key: "actions",
                label: "Options",
                render: (row) => (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownloadInvoice(row.id)} title="Download PDF">
                      <Download className="h-4 w-4" /> PDF
                    </Button>
                    
                    {!isAdmin && row.status === "pending" && (
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl" onClick={() => handlePayInvoice(row)}>
                        Pay Online
                      </Button>
                    )}

                    {isAdmin && row.status !== "paid" && row.status !== "cancelled" && row.status !== "refunded" && (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => handleOpenEditModal(row)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl" onClick={() => handleCancelInvoice(row.id)}>
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Tab Contents: Payments History */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {isAdmin ? "Global Payment History" : "My Payments History"}
            </h3>
          </div>

          <PaginatedTable
            rows={payments}
            emptyState={
              <EmptyState
                title="No transaction logs yet"
                description="Completed transactions will be cataloged here automatically."
              />
            }
            columns={[
              { key: "transactionId", label: "Transaction Reference ID", render: (row) => <span className="font-mono text-xs">{row.transactionId || "Pending Verification"}</span> },
              { key: "invoiceNumber", label: "Invoice Number" },
              { key: "patientName", label: "Patient" },
              { key: "paymentMethodLabel", label: "Method / Portal" },
              { key: "amount", label: "Amount", render: (row) => formatCurrency(row.amountCents) },
              { key: "status", label: "Status", render: (row) => <Badge tone={statusTone(row.status)}>{row.status.toUpperCase()}</Badge> },
              { key: "paidAt", label: "Time Settled", render: (row) => formatDateTime(row.paidAt) },
              {
                key: "actions",
                label: "Admin Actions",
                render: (row) => (
                  <div>
                    {isAdmin && row.status === "paid" && (
                      <Button size="sm" variant="outline" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => handleRefund(row.id)}>
                        Issue Refund
                      </Button>
                    )}
                    {!isAdmin && <span className="text-slate-400 text-xs italic">Verified</span>}
                  </div>
                )
              }
            ]}
          />
        </div>
      )}

      {/* Invoice Management Modal (Add/Edit) */}
      <Modal
        open={isInvoiceModalOpen}
        onClose={() => setIsInvoiceModalOpen(false)}
        title={editingInvoice ? `Modify Invoice - ${editingInvoice.invoiceNumber}` : "Generate New Hospital Invoice"}
      >
        <form onSubmit={handleSaveInvoice} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Select Patient</label>
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

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Invoice Status</label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
                className="w-full h-11 px-4 rounded-2xl border border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="pending">Pending</option>
                {editingInvoice && <option value="paid">Paid</option>}
              </select>
            </div>
          </div>

          {/* Itemized Line Builder */}
          <div className="space-y-3.5 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400">Line Items & Services</h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                <Plus className="h-4.5 w-4.5" /> Add Service Row
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
                    placeholder="e.g. Blood Test, General Consultation"
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
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div className="grid gap-4 md:grid-cols-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tax rate (%)</label>
              <Input
                type="number"
                value={formTaxRate}
                onChange={(e) => setFormTaxRate(Number(e.target.value))}
                min="0"
                max="100"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Discount Amount (INR)</label>
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
              <span className="text-xxs text-slate-400">Subtotal: INR {formSubtotal.toFixed(2)} | Tax: INR {formTaxAmount.toFixed(2)}</span>
            </div>
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

      {/* Checkout Method Selection Modal */}
      <Modal
        open={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        title="Complete Payment Settlement"
      >
        <div className="space-y-6">
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase">Invoice Due</div>
              <div className="text-lg font-mono font-bold text-slate-950 dark:text-white">
                {checkoutInvoice?.invoiceNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-400 font-bold uppercase">Amount Payable</div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                {checkoutInvoice && formatCurrency(checkoutInvoice.amountCents)}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Choose Payment Method</label>
            <div className="grid grid-cols-2 gap-3.5">
              {[
                { id: "UPI", label: "UPI (GPay / PhonePe)", icon: Sparkles },
                { id: "Credit Card", label: "Credit Card", icon: CreditCard },
                { id: "Debit Card", label: "Debit Card", icon: Landmark },
                { id: "Net Banking", label: "Net Banking", icon: DollarSign }
              ].map((method) => {
                const Icon = method.icon;
                const active = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      active
                        ? "border-brand-500 bg-brand-50/50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className={`p-2 rounded-xl ${active ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-900 text-slate-500"}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">{method.id}</div>
                      <div className="text-xxs text-slate-400">{method.label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-5 dark:border-slate-800">
            <Button variant="outline" onClick={() => setIsCheckoutOpen(false)}>
              Cancel
            </Button>
            <Button onClick={executePaymentCheckout} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl shadow-lg">
              Proceed to Checkout
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
