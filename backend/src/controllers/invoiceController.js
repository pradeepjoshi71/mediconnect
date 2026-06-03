const { z } = require("zod");
const invoiceService = require("../services/invoiceService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const invoiceItemSchema = z.object({
  itemType: z.enum(["consultation", "laboratory", "pharmacy", "procedure", "admission"]),
  itemName: z.string().min(1).max(255),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative()
});

const createInvoiceSchema = z.object({
  patientId: z.number().int().positive(),
  appointmentId: z.number().int().positive().optional().nullable(),
  subtotal: z.number().nonnegative(),
  taxAmount: z.number().nonnegative().default(0),
  discountAmount: z.number().nonnegative().default(0),
  status: z.enum(["draft", "pending", "paid", "cancelled", "refunded"]).default("draft"),
  items: z.array(invoiceItemSchema).default([])
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const createInvoiceHandler = asyncHandler(async (req, res) => {
  const payload = createInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.createInvoice(req.user, payload, req.auditContext);
  res.status(201).json(invoice);
});

const updateInvoiceHandler = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateInvoiceSchema.parse(req.body);
  const invoice = await invoiceService.updateInvoice(req.user, params.id, payload, req.auditContext);
  res.json(invoice);
});

const getInvoiceByIdHandler = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const invoice = await invoiceService.getInvoiceById(req.user, params.id, req.auditContext);
  res.json(invoice);
});

const listInvoicesHandler = asyncHandler(async (req, res) => {
  const filters = z.object({
    patientId: z.coerce.number().int().positive().optional(),
    status: z.enum(["draft", "pending", "paid", "cancelled", "refunded"]).optional()
  }).parse(req.query);

  const invoices = await invoiceService.listInvoices(req.user, filters, req.auditContext);
  res.json(invoices);
});

const cancelInvoiceHandler = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const invoice = await invoiceService.cancelInvoice(req.user, params.id, req.auditContext);
  res.json(invoice);
});

const getRevenueReportsHandler = asyncHandler(async (req, res) => {
  const reports = await invoiceService.getRevenueReports(req.user, req.auditContext);
  res.json(reports);
});

module.exports = {
  createInvoice: createInvoiceHandler,
  updateInvoice: updateInvoiceHandler,
  getInvoiceById: getInvoiceByIdHandler,
  listInvoices: listInvoicesHandler,
  cancelInvoice: cancelInvoiceHandler,
  getRevenueReports: getRevenueReportsHandler
};
