const crypto = require("crypto");
const paymentRepository = require("../repositories/paymentRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { buildPdfBuffer } = require("../utils/pdf");
const { AppError } = require("../utils/http");

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const isRazorpayConfigured = !!(razorpayKeyId && razorpayKeySecret && razorpayKeyId !== "mock" && razorpayKeySecret !== "mock");

async function createRazorpayOrder(amount, receipt) {
  if (!isRazorpayConfigured) {
    // Sandbox Mock Mode
    return {
      id: `order_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      amount: Math.round(amount * 100), // in paise
      currency: "INR",
      receipt
    };
  }

  const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: String(receipt).substring(0, 40)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay Order creation failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function refundRazorpayPayment(paymentId, amount) {
  if (!isRazorpayConfigured) {
    // Sandbox Mock Mode
    return {
      id: `rfnd_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      amount: Math.round(amount * 100),
      currency: "INR"
    };
  }

  const auth = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100)
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Razorpay Refund failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!isRazorpayConfigured) {
    return signature && (signature.startsWith("sig_mock") || signature.length > 5);
  }

  const generatedSignature = crypto
    .createHmac("sha256", razorpayKeySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");

  return generatedSignature === signature;
}

async function createOrder(user, { invoiceId, paymentMethod }, context) {
  const invoice = await invoiceRepository.findInvoiceById(invoiceId, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== invoice.patientId) {
      throw new AppError(403, "Forbidden: you can only pay your own invoices");
    }
  }

  // Create Order in Razorpay (or mock)
  const order = await createRazorpayOrder(Number(invoice.totalAmount), `rcpt_${invoiceId}`);

  // Create payment record in database
  const payment = await paymentRepository.createPayment({
    hospitalId: user.hospitalId,
    invoiceId,
    patientId: invoice.patientId,
    paymentMethod,
    paymentProvider: isRazorpayConfigured ? "Razorpay" : "Razorpay Mock",
    transactionId: null,
    amount: invoice.totalAmount,
    status: "pending",
    razorpayOrderId: order.id,
    razorpayPaymentId: null,
    razorpaySignature: null
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.order_created",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId, orderId: order.id, amount: invoice.totalAmount },
      context
    });
  }

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    paymentId: payment.id,
    invoiceId,
    razorpayKeyId: razorpayKeyId || "rzp_test_mockkey123"
  };
}

async function verifyPayment(user, payload, context) {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, invoiceId, paymentMethod } = payload;

  const verified = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!verified) {
    throw new AppError(400, "Invalid payment signature verification failed");
  }

  const payment = await paymentRepository.findPaymentByOrderId(razorpayOrderId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment transaction record not found");
  }

  // Update payment status
  const updatedPayment = await paymentRepository.updatePayment(payment.id, user.hospitalId, {
    status: "paid",
    transactionId: razorpayPaymentId,
    razorpayPaymentId,
    razorpaySignature
  });

  // Update invoice status
  await invoiceRepository.updateInvoiceStatus(invoiceId, user.hospitalId, "paid");

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.verified",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId, razorpayPaymentId, status: "paid" },
      context
    });
  }

  return { success: true, payment: updatedPayment };
}

async function refundPayment(user, { paymentId, amount }, context) {
  if (!["admin", "super_admin", "hospital_admin", "billing_executive"].includes(user.role)) {
    throw new AppError(403, "Forbidden: insufficient permissions to refund payments");
  }

  const payment = await paymentRepository.findPaymentById(paymentId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment record not found");
  }

  if (payment.status !== "paid") {
    throw new AppError(400, "Only paid transactions can be refunded");
  }

  const refundAmount = amount !== undefined ? Number(amount) : Number(payment.amount);
  if (refundAmount <= 0 || refundAmount > Number(payment.amount)) {
    throw new AppError(400, "Invalid refund amount specified");
  }

  // Refund via Razorpay
  const razorpayPaymentId = payment.razorpayPaymentId || "pay_mock12345678";
  await refundRazorpayPayment(razorpayPaymentId, refundAmount);

  // Update status in DB
  const updatedPayment = await paymentRepository.updatePayment(paymentId, user.hospitalId, {
    status: "refunded"
  });

  // Update invoice status to refunded
  await invoiceRepository.updateInvoiceStatus(payment.invoiceId, user.hospitalId, "refunded");

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.refunded",
      entityType: "payment",
      entityId: paymentId,
      metadata: { invoiceId: payment.invoiceId, amount: refundAmount },
      context
    });
  }

  return { success: true, payment: updatedPayment };
}

async function listPayments(user, context) {
  const patient = user.role === "patient"
    ? await patientRepository.findPatientByUserId(user.id, user.hospitalId)
    : null;

  const payments = await paymentRepository.listPayments({
    hospitalId: user.hospitalId,
    role: user.role,
    patientId: patient?.id,
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payments.view",
      entityType: "payment",
      entityId: patient?.id || "hospital",
      metadata: {
        paymentCount: payments.length,
        role: user.role,
      },
      context,
    });
  }

  return payments;
}

async function buildInvoicePdf(user, invoiceId, context) {
  const invoice = await invoiceRepository.findInvoiceById(invoiceId, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== invoice.patientId) {
      throw new AppError(403, "Forbidden: you cannot download other patients' invoices");
    }
  }

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.download",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      context,
    });
  }

  const itemsLines = (invoice.items || []).map(
    (item) =>
      `- ${item.itemName} (${item.itemType}) | Qty: ${item.quantity} | Unit: INR ${Number(item.unitPrice).toFixed(2)} | Total: INR ${Number(item.totalPrice).toFixed(2)}`
  );

  return {
    fileName: `${invoice.invoiceNumber}.pdf`,
    buffer: buildPdfBuffer({
      title: `Invoice ${invoice.invoiceNumber}`,
      subtitle: "MediConnect Hospital Billing",
      sections: [
        {
          heading: "Hospital Details",
          lines: [
            `Hospital: ${invoice.hospitalName || user.hospitalName || "MediConnect Hospital"}`,
            `Branch: ${invoice.hospitalCode || user.hospitalCode || "MCH-BLR"}`,
            `Contact: +91-80-4412-3300`,
            `Email: billing@mediconnect.local`
          ],
        },
        {
          heading: "Patient Details",
          lines: [
            `Name: ${invoice.patientName}`,
            `MRN: ${invoice.patientMRN}`,
            `Email: ${invoice.patientEmail || "N/A"}`,
            `Phone: ${invoice.patientPhone || "N/A"}`,
          ],
        },
        {
          heading: "Invoice Items",
          lines: itemsLines.length > 0 ? itemsLines : ["No line items recorded"],
        },
        {
          heading: "Totals & Summary",
          lines: [
            `Subtotal: INR ${Number(invoice.subtotal).toFixed(2)}`,
            `Tax: INR ${Number(invoice.taxAmount).toFixed(2)}`,
            `Discount: INR ${Number(invoice.discountAmount).toFixed(2)}`,
            `Grand Total: INR ${Number(invoice.totalAmount).toFixed(2)}`,
          ],
        },
        {
          heading: "Payment Status",
          lines: [
            `Status: ${invoice.status.toUpperCase()}`,
            `Generated at: ${new Date(invoice.createdAt).toLocaleString()}`,
          ],
        },
      ],
    }),
  };
}

// Keep legacy mock checkout working to avoid breaking other files
async function createCheckout(user, paymentId, provider, context) {
  const payment = await paymentRepository.findPaymentById(paymentId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment transaction not found");
  }

  const updated = await paymentRepository.updatePayment(paymentId, user.hospitalId, {
    status: "processing"
  });

  return {
    payment: updated,
    checkoutUrl: `https://payments.local/mock/${paymentId}`,
    note: "External checkout legacy path active."
  };
}

module.exports = {
  createOrder,
  verifyPayment,
  refundPayment,
  listPayments,
  buildInvoicePdf,
  createCheckout
};
