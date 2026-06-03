const invoiceRepository = require("../repositories/invoiceRepository");
const patientRepository = require("../repositories/patientRepository");
const auditService = require("./auditService");
const { AppError } = require("../utils/http");

function nextInvoiceNumber() {
  return `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
}

async function createInvoice(user, payload, context) {
  if (!["admin", "super_admin", "hospital_admin", "billing_executive", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Forbidden: insufficient permissions to create invoices");
  }

  const invoiceNumber = nextInvoiceNumber();
  const subtotal = Number(payload.subtotal || 0);
  const taxAmount = Number(payload.taxAmount || 0);
  const discountAmount = Number(payload.discountAmount || 0);
  const totalAmount = Number((subtotal + taxAmount - discountAmount).toFixed(2));

  const data = {
    invoiceNumber,
    patientId: payload.patientId,
    appointmentId: payload.appointmentId || null,
    createdBy: user.id,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    status: payload.status || "draft",
    items: payload.items || []
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
  if (!["admin", "super_admin", "hospital_admin", "billing_executive", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Forbidden: insufficient permissions to update invoices");
  }

  const invoice = await invoiceRepository.findInvoiceById(id, user.hospitalId);
  if (!invoice) {
    throw new AppError(404, "Invoice not found");
  }

  if (invoice.status === "paid" || invoice.status === "refunded") {
    throw new AppError(400, `Cannot modify an invoice that is already ${invoice.status}`);
  }

  const subtotal = payload.subtotal !== undefined ? Number(payload.subtotal) : Number(invoice.subtotal);
  const taxAmount = payload.taxAmount !== undefined ? Number(payload.taxAmount) : Number(invoice.taxAmount);
  const discountAmount = payload.discountAmount !== undefined ? Number(payload.discountAmount) : Number(invoice.discountAmount);
  const totalAmount = Number((subtotal + taxAmount - discountAmount).toFixed(2));

  const data = {
    patientId: payload.patientId || invoice.patientId,
    appointmentId: payload.appointmentId !== undefined ? payload.appointmentId : invoice.appointmentId,
    subtotal,
    taxAmount,
    discountAmount,
    totalAmount,
    status: payload.status || invoice.status,
    items: payload.items || invoice.items
  };

  await invoiceRepository.updateInvoice(id, user.hospitalId, data);

  if (context) {
    await auditService.recordAuditEvent({
      user,
      action: "billing.invoice.update",
      entityType: "invoice",
      entityId: id,
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
