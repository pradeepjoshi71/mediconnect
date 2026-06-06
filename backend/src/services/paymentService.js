const crypto = require("crypto");
const db = require("../config/db");
const paymentRepository = require("../repositories/paymentRepository");
const invoiceRepository = require("../repositories/invoiceRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { buildPdfBuffer } = require("../utils/pdf");
const { AppError } = require("../utils/http");

const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;
const isRazorpayConfigured = !!(razorpayKeyId && razorpayKeySecret && razorpayKeyId !== "mock" && razorpayKeySecret !== "mock");

// Override createPayment to fix Postgres inconsistent type deduction (error 42P08)
// and include new offline payment columns
paymentRepository.createPayment = async function({
  hospitalId,
  invoiceId,
  patientId,
  paymentMethod,
  paymentProvider,
  transactionId,
  amount,
  status,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  source,
  referenceNumber,
  receivedBy,
  notes
}) {
  const result = await db.query(
    `
      INSERT INTO payments (
        hospital_id,
        invoice_id,
        patient_id,
        payment_method,
        payment_provider,
        transaction_id,
        amount,
        status,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        source,
        reference_number,
        received_by,
        notes,
        paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::varchar, $9, $10, $11, $12, $13, $14, $15,
        CASE WHEN $8::varchar = 'paid'::varchar THEN now() ELSE null END)
      RETURNING id
    `,
    [
      hospitalId,
      invoiceId,
      patientId,
      paymentMethod,
      paymentProvider || "Razorpay",
      transactionId || null,
      amount,
      status || "pending",
      razorpayOrderId || null,
      razorpayPaymentId || null,
      razorpaySignature || null,
      source || "online",
      referenceNumber || null,
      receivedBy || null,
      notes || null
    ]
  );
  return paymentRepository.findPaymentById(result.rows[0].id, hospitalId);
};

// Override updatePayment with explicit ::varchar casts to avoid PG type conflicts
paymentRepository.updatePayment = async function(id, hospitalId, patch) {
  const result = await db.query(
    `
      UPDATE payments
      SET
        status = COALESCE($2::varchar, status),
        transaction_id = COALESCE($3::varchar, transaction_id),
        razorpay_payment_id = COALESCE($4::varchar, razorpay_payment_id),
        razorpay_signature = COALESCE($5::varchar, razorpay_signature),
        paid_at = CASE WHEN $2::varchar = 'paid'::varchar THEN now() ELSE paid_at END,
        updated_at = now()
      WHERE id = $1 AND hospital_id = $6
      RETURNING id
    `,
    [
      id,
      patch.status || null,
      patch.transactionId || null,
      patch.razorpayPaymentId || null,
      patch.razorpaySignature || null,
      hospitalId
    ]
  );
  return result.rows[0] ? paymentRepository.findPaymentById(result.rows[0].id, hospitalId) : null;
};

// ─── Razorpay Helpers ────────────────────────────────────────────────────────

async function createRazorpayOrder(amount, receipt) {
  if (!isRazorpayConfigured) {
    return {
      id: `order_mock_${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      amount: Math.round(amount * 100),
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

// ─── Invoice Status Sync ─────────────────────────────────────────────────────

/**
 * Recomputes invoice status from the actual sum of paid payment records.
 * - paid_amount = 0           → pending
 * - 0 < paid_amount < total   → partially_paid
 * - paid_amount >= total      → paid
 * This is the only authoritative way to set invoice status after a payment.
 */
async function syncInvoiceStatus(invoiceId, hospitalId) {
  const invoice = await invoiceRepository.findInvoiceById(invoiceId, hospitalId);
  if (!invoice) return;

  const totalAmount = Number(invoice.totalAmount);
  const paidAmount = await paymentRepository.computeInvoicePaidAmount(invoiceId, hospitalId);

  let newStatus;
  if (paidAmount <= 0) {
    newStatus = "pending";
  } else if (paidAmount < totalAmount) {
    newStatus = "partially_paid";
  } else {
    newStatus = "paid";
  }

  // Only update if status actually changes
  if (invoice.status !== newStatus) {
    await invoiceRepository.updateInvoiceStatus(invoiceId, hospitalId, newStatus);
  }

  return newStatus;
}

// ─── Service Functions ───────────────────────────────────────────────────────

async function createOrder(user, { invoiceId, paymentMethod }, context) {
  const invoice = await invoiceRepository.findInvoiceById(invoiceId, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new AppError(400, "Invoice is already fully paid");
  }
  if (invoice.status === "cancelled" || invoice.status === "refunded") {
    throw new AppError(400, `Cannot create a payment order for a ${invoice.status} invoice`);
  }

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== invoice.patientId) {
      throw new AppError(403, "Forbidden: you can only pay your own invoices");
    }
  }

  // Use balance due, not total, in case of partial prior payments
  const balanceDue = Number(invoice.balanceDue ?? invoice.totalAmount);
  if (balanceDue <= 0) {
    throw new AppError(400, "No outstanding balance on this invoice");
  }

  const order = await createRazorpayOrder(balanceDue, `rcpt_${invoiceId}`);

  const payment = await paymentRepository.createPayment({
    hospitalId: user.hospitalId,
    invoiceId,
    patientId: invoice.patientId,
    paymentMethod,
    paymentProvider: isRazorpayConfigured ? "Razorpay" : "Razorpay Mock",
    transactionId: null,
    amount: balanceDue,
    status: "pending",
    razorpayOrderId: order.id,
    razorpayPaymentId: null,
    razorpaySignature: null,
    source: "online"
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.order_created",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId, orderId: order.id, amount: balanceDue },
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
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, paymentMethod } = payload;

  const verified = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!verified) {
    throw new AppError(400, "Invalid payment signature verification failed");
  }

  const payment = await paymentRepository.findPaymentByOrderId(razorpayOrderId, user.hospitalId);
  if (!payment) {
    throw new AppError(404, "Payment transaction record not found");
  }

  if (payment.status === "paid") {
    return { success: true, payment, alreadyPaid: true };
  }

  const updatedPayment = await paymentRepository.updatePayment(payment.id, user.hospitalId, {
    status: "paid",
    transactionId: razorpayPaymentId,
    razorpayPaymentId,
    razorpaySignature
  });

  // Compute invoice status from all paid payments — never hard-code "paid"
  await syncInvoiceStatus(payment.invoiceId, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.verified",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId: payment.invoiceId, razorpayPaymentId, status: "paid" },
      context
    });
  }

  return { success: true, payment: updatedPayment };
}

async function recordOfflinePayment(user, payload, context) {
  const {
    invoiceId,
    amount,
    paymentMethod,
    referenceNumber,
    notes,
    receivedBy
  } = payload;

  const invoice = await invoiceRepository.findInvoiceById(invoiceId, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new AppError(400, "Invoice is already fully paid");
  }
  if (invoice.status === "cancelled" || invoice.status === "refunded") {
    throw new AppError(400, `Cannot record payment for a ${invoice.status} invoice`);
  }

  const paymentAmount = Number(amount);
  const balanceDue = Number(invoice.balanceDue ?? invoice.totalAmount);
  if (paymentAmount <= 0) {
    throw new AppError(400, "Payment amount must be greater than zero");
  }
  if (paymentAmount > balanceDue + 0.01) { // 0.01 tolerance for floating point
    throw new AppError(400, `Payment amount (${paymentAmount}) exceeds balance due (${balanceDue})`);
  }

  const payment = await paymentRepository.createPayment({
    hospitalId: user.hospitalId,
    invoiceId,
    patientId: invoice.patientId,
    paymentMethod,
    paymentProvider: "Offline",
    transactionId: referenceNumber || null,
    amount: paymentAmount,
    status: "paid",
    razorpayOrderId: null,
    razorpayPaymentId: null,
    razorpaySignature: null,
    source: "offline",
    referenceNumber: referenceNumber || null,
    receivedBy: receivedBy || user.id,
    notes: notes || null
  });

  // Compute invoice status from all paid payments
  const newStatus = await syncInvoiceStatus(invoiceId, user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.payment.offline_recorded",
      entityType: "payment",
      entityId: payment.id,
      metadata: {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        amount: paymentAmount,
        paymentMethod,
        referenceNumber,
        newInvoiceStatus: newStatus,
        source: "offline"
      },
      context
    });
  }

  return { success: true, payment, invoiceStatus: newStatus };
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

  const razorpayPaymentId = payment.razorpayPaymentId || "pay_mock12345678";
  await refundRazorpayPayment(razorpayPaymentId, refundAmount);

  const updatedPayment = await paymentRepository.updatePayment(paymentId, user.hospitalId, {
    status: "refunded"
  });

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

  const paidAmount = Number(invoice.paidAmount || 0);
  const balanceDue = Number(invoice.balanceDue || invoice.totalAmount);

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
            `Amount Paid: INR ${paidAmount.toFixed(2)}`,
            `Balance Due: INR ${balanceDue.toFixed(2)}`,
          ],
        },
        {
          heading: "Payment Status",
          lines: [
            `Status: ${invoice.status.toUpperCase().replace("_", " ")}`,
            `Generated at: ${new Date(invoice.createdAt).toLocaleString()}`,
          ],
        },
      ],
    }),
  };
}

// Legacy: keep for BookingPage checkout flow
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

async function createInvoiceForAppointment({ appointment, hospitalId, initiatedByUserId }) {
  const feeCents = Number(appointment.consultationFeeCents || 0);
  const fee = Number((feeCents / 100).toFixed(2));
  const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

  const invoiceId = await invoiceRepository.createInvoice(hospitalId, {
    invoiceNumber,
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    createdBy: initiatedByUserId,
    subtotal: fee,
    taxAmount: 0.00,
    discountAmount: 0.00,
    totalAmount: fee,
    status: fee === 0 ? "paid" : "pending",
    items: [
      {
        itemType: "consultation",
        itemName: `Consultation Fee - ${appointment.doctorName || "Doctor"}`,
        quantity: 1,
        unitPrice: fee,
        totalPrice: fee,
      },
    ],
  });

  let payment = null;
  if (fee > 0) {
    const order = await createRazorpayOrder(fee, `rcpt_${invoiceId}`);
    payment = await paymentRepository.createPayment({
      hospitalId,
      invoiceId,
      patientId: appointment.patientId,
      paymentMethod: "UPI",
      paymentProvider: isRazorpayConfigured ? "Razorpay" : "Razorpay Mock",
      amount: fee,
      status: "pending",
      razorpayOrderId: order.id,
      razorpayPaymentId: null,
      razorpaySignature: null,
      source: "online"
    });
  } else {
    payment = await paymentRepository.createPayment({
      hospitalId,
      invoiceId,
      patientId: appointment.patientId,
      paymentMethod: "Cash",
      paymentProvider: "System",
      transactionId: `free_${appointment.id}`,
      amount: 0,
      status: "paid",
      razorpayOrderId: null,
      razorpayPaymentId: null,
      razorpaySignature: null,
      source: "offline"
    });
  }

  await auditService.recordAuditEvent({
    user: { id: initiatedByUserId, role: "admin", hospitalId },
    action: "billing.invoice.create_for_appointment",
    entityType: "invoice",
    entityId: invoiceId,
    metadata: { invoiceNumber, totalAmount: fee, appointmentId: appointment.id },
  });

  return payment;
}

async function handleWebhook(payload, signature) {
  if (isRazorpayConfigured) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(payload))
      .digest("hex");
    if (expectedSignature !== signature) {
      throw new AppError(400, "Invalid webhook signature");
    }
  }

  const event = payload.event;
  const paymentEntity = payload.payload?.payment?.entity;
  if (!paymentEntity) {
    return { success: false, message: "No payment entity found" };
  }

  const orderId = paymentEntity.order_id;
  const razorpayPaymentId = paymentEntity.id;

  const result = await db.query(
    `
      SELECT id, hospital_id AS "hospitalId", invoice_id AS "invoiceId", amount, status
      FROM payments
      WHERE razorpay_order_id = $1
      LIMIT 1
    `,
    [orderId]
  );
  const payment = result.rows[0];
  if (!payment) {
    return { success: false, message: "Order not found" };
  }

  const hospitalId = payment.hospitalId;

  if (payment.status === "paid" && event === "payment.captured") {
    return { success: true, message: "Payment already marked paid" };
  }

  if (event === "payment.captured") {
    await paymentRepository.updatePayment(payment.id, hospitalId, {
      status: "paid",
      transactionId: razorpayPaymentId,
      razorpayPaymentId
    });

    // Use syncInvoiceStatus for accurate partial payment handling
    await syncInvoiceStatus(payment.invoiceId, hospitalId);

    await auditService.recordAuditEvent({
      user: { id: 0, role: "system", hospitalId },
      action: "billing.payment.captured_webhook",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId: payment.invoiceId, orderId, razorpayPaymentId }
    });

    return { success: true, message: "Payment captured successfully" };
  } else if (event === "payment.failed") {
    await paymentRepository.updatePayment(payment.id, hospitalId, {
      status: "failed",
      transactionId: razorpayPaymentId,
      razorpayPaymentId
    });

    await auditService.recordAuditEvent({
      user: { id: 0, role: "system", hospitalId },
      action: "billing.payment.failed_webhook",
      entityType: "payment",
      entityId: payment.id,
      metadata: { invoiceId: payment.invoiceId, orderId, razorpayPaymentId }
    });

    return { success: true, message: "Payment marked failed" };
  }

  return { success: true, message: "Event ignored" };
}

module.exports = {
  createOrder,
  verifyPayment,
  recordOfflinePayment,
  refundPayment,
  listPayments,
  buildInvoicePdf,
  createCheckout,
  createInvoiceForAppointment,
  handleWebhook
};
