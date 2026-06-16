const invoiceRepository = require("../repositories/invoiceRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");
const { hasPermission } = require("../utils/rbac");

function nextInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createInvoice(user, payload, context) {
  if (!hasPermission(user, "manage_billing", "record_payments")) {
    throw new AppError(403, "Forbidden: insufficient permissions to create invoices");
  }

  const invoiceNumber = nextInvoiceNumber();

  // Recalculate each item's total price and calculate subtotal
  const items = payload.items || [];
  let calculatedSubtotal = 0;
  for (const item of items) {
    item.totalPrice = Number((Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2));
    calculatedSubtotal += item.totalPrice;
  }
  calculatedSubtotal = Number(calculatedSubtotal.toFixed(2));

  // Recalculate taxAmount as flat 5% of subtotal
  const calculatedTaxAmount = Number((calculatedSubtotal * 0.05).toFixed(2));

  // Validate discountAmount to ensure it is positive and <= subtotal + tax
  let discountAmount = Number(payload.discountAmount || 0);
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > calculatedSubtotal + calculatedTaxAmount) {
    discountAmount = calculatedSubtotal + calculatedTaxAmount;
  }
  discountAmount = Number(discountAmount.toFixed(2));

  const totalAmount = Number((calculatedSubtotal + calculatedTaxAmount - discountAmount).toFixed(2));

  const data = {
    invoiceNumber,
    patientId: payload.patientId,
    appointmentId: payload.appointmentId || null,
    createdBy: user.id,
    subtotal: calculatedSubtotal,
    taxAmount: calculatedTaxAmount,
    discountAmount,
    totalAmount,
    status: payload.status || "draft",
    items
  };

  const invoiceId = await invoiceRepository.createInvoice(user.hospitalId, data);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.create",
      entityType: "invoice",
      entityId: invoiceId,
      metadata: { invoiceNumber, totalAmount },
      context
    });
  }

  return getInvoiceById(user, invoiceId, context);
}

async function updateInvoice(user, id, payload, context) {
  if (!hasPermission(user, "manage_billing")) {
    throw new AppError(403, "Forbidden: insufficient permissions to update invoices");
  }

  const invoice = await invoiceRepository.findInvoiceById(id, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === "paid" || invoice.status === "refunded") {
    throw new AppError(400, `Cannot modify an invoice that is already ${invoice.status}`);
  }

  // Recalculate subtotal
  let subtotal = Number(invoice.subtotal);
  let items = invoice.items;
  if (payload.items !== undefined) {
    items = payload.items;
    let calculatedSubtotal = 0;
    for (const item of items) {
      item.totalPrice = Number((Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2));
      calculatedSubtotal += item.totalPrice;
    }
    subtotal = Number(calculatedSubtotal.toFixed(2));
  }

  const taxAmount = Number((subtotal * 0.05).toFixed(2));

  let discountAmount = payload.discountAmount !== undefined ? Number(payload.discountAmount) : Number(invoice.discountAmount);
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > subtotal + taxAmount) {
    discountAmount = subtotal + taxAmount;
  }
  discountAmount = Number(discountAmount.toFixed(2));

  const totalAmount = Number((subtotal + taxAmount - discountAmount).toFixed(2));

  const data = {
    patientId: payload.patientId || invoice.patientId,
    appointmentId: payload.appointmentId !== undefined ? payload.appointmentId : invoice.appointmentId,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    status: payload.status || invoice.status,
    items
  };

  await invoiceRepository.updateInvoice(id, user.hospitalId, data);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.update",
      entityType: "invoice",
      entityId: id,
      oldValue: { status: invoice.status, totalAmount: Number(invoice.totalAmount) },
      newValue: { status: data.status, totalAmount },
      metadata: { invoiceNumber: invoice.invoiceNumber, totalAmount },
      context
    });
  }

  return getInvoiceById(user, id, context);
}

async function getInvoiceById(user, id, context) {
  const invoice = await invoiceRepository.findInvoiceById(id, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  // RBAC checks
  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient || patient.id !== invoice.patientId) {
      throw new AppError(403, "Forbidden: you can only access your own invoices");
    }
  }

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.view",
      entityType: "invoice",
      entityId: id,
      metadata: { invoiceNumber: invoice.invoiceNumber },
      context
    });
  }

  return invoice;
}

async function listInvoices(user, filters, context) {
  let patientId = filters.patientId;

  if (user.role === "patient") {
    const patient = await patientRepository.findPatientByUserId(user.id, user.hospitalId);
    if (!patient) {
      throw new AppError(404, "Patient profile not found");
    }
    patientId = patient.id;
  }

  const invoices = await invoiceRepository.listInvoices({
    hospitalId: user.hospitalId,
    patientId,
    status: filters.status
  });

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoices.list",
      entityType: "invoice",
      entityId: "hospital",
      metadata: { count: invoices.length, patientIdFiltered: !!patientId },
      context
    });
  }

  return invoices;
}

async function cancelInvoice(user, id, context) {
  if (!["admin", "super_admin", "hospital_admin", "billing_executive", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Forbidden: insufficient permissions to cancel invoices");
  }

  const invoice = await invoiceRepository.findInvoiceById(id, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === "paid" || invoice.status === "refunded") {
    throw new AppError(400, `Cannot cancel an invoice that is already ${invoice.status}`);
  }

  await invoiceRepository.updateInvoiceStatus(id, user.hospitalId, "cancelled");

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.cancel",
      entityType: "invoice",
      entityId: id,
      oldValue: { status: invoice.status },
      newValue: { status: "cancelled" },
      metadata: { invoiceNumber: invoice.invoiceNumber },
      context
    });
  }

  return getInvoiceById(user, id, context);
}

async function getRevenueReports(user, context) {
  if (!["admin", "super_admin", "hospital_admin", "billing_executive"].includes(user.role)) {
    throw new AppError(403, "Forbidden: insufficient permissions to view financial metrics");
  }

  const metrics = await invoiceRepository.getRevenueMetrics(user.hospitalId);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.reports.view",
      entityType: "metrics",
      entityId: "hospital",
      metadata: metrics,
      context
    });
  }

  return metrics;
}

module.exports = {
  createInvoice,
  updateInvoice,
  getInvoiceById,
  listInvoices,
  cancelInvoice,
  getRevenueReports
};
