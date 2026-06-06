const { z } = require("zod");
const paymentService = require("../services/paymentService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const onlinePaymentMethodSchema = z.enum(["UPI", "Credit Card", "Debit Card", "Net Banking", "Wallet"]);
const offlinePaymentMethodSchema = z.enum(["Cash", "UPI", "Card Machine", "Bank Transfer"]);

const createOrderSchema = z.object({
  invoiceId: z.number().int().positive(),
  paymentMethod: onlinePaymentMethodSchema.default("UPI")
});

const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  invoiceId: z.number().int().positive(),
  paymentMethod: onlinePaymentMethodSchema.default("UPI")
});

const refundSchema = z.object({
  paymentId: z.number().int().positive(),
  amount: z.number().positive().optional()
});

const offlinePaymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive(),
  paymentMethod: offlinePaymentMethodSchema,
  referenceNumber: z.string().max(255).optional(),
  notes: z.string().max(1000).optional(),
  receivedBy: z.number().int().positive().optional()
});

const createOrder = asyncHandler(async (req, res) => {
  const payload = createOrderSchema.parse(req.body);
  const result = await paymentService.createOrder(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const payload = verifyPaymentSchema.parse(req.body);
  const result = await paymentService.verifyPayment(req.user, payload, req.auditContext);
  res.json(result);
});

const recordOfflinePayment = asyncHandler(async (req, res) => {
  const payload = offlinePaymentSchema.parse(req.body);
  const result = await paymentService.recordOfflinePayment(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const refundPayment = asyncHandler(async (req, res) => {
  const payload = refundSchema.parse(req.body);
  const result = await paymentService.refundPayment(req.user, payload, req.auditContext);
  res.json(result);
});

const paymentHistory = asyncHandler(async (req, res) => {
  const history = await paymentService.listPayments(req.user, req.auditContext);
  res.json(history);
});

// Legacy backward-compatibility endpoints
const listPayments = asyncHandler(async (req, res) => {
  res.json(await paymentService.listPayments(req.user, req.auditContext));
});

const createCheckout = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = z.object({ provider: z.string() }).parse(req.body);
  res.json(
    await paymentService.createCheckout(req.user, params.id, payload.provider, req.auditContext)
  );
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const result = await paymentService.verifyPayment(req.user, {
    razorpayOrderId: "order_legacy",
    razorpayPaymentId: "pay_legacy",
    razorpaySignature: "sig_legacy",
    invoiceId: params.id,
    paymentMethod: "Credit Card"
  }, req.auditContext);
  res.json(result.payment);
});

const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const pdf = await paymentService.buildInvoicePdf(req.user, params.id, req.auditContext);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdf.fileName}"`);
  res.send(pdf.buffer);
});

module.exports = {
  createOrder,
  verifyPayment,
  recordOfflinePayment,
  refundPayment,
  paymentHistory,
  listPayments,
  createCheckout,
  updatePaymentStatus,
  downloadInvoicePdf,
};
