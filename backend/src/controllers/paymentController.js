const { z } = require("zod");
const paymentService = require("../services/paymentService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const checkoutSchema = z.object({
  provider: z.enum(["stripe", "razorpay", "cash", "insurance"]).default("stripe"),
});

const statusSchema = z.object({
  status: z.enum(["pending", "processing", "paid", "failed", "cancelled", "refunded"]),
});

const listPayments = asyncHandler(async (req, res) => {
  res.json(await paymentService.listPayments(req.user, req.auditContext));
});

const createCheckout = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = checkoutSchema.parse(req.body);
  res.json(
    await paymentService.createCheckout(req.user, params.id, payload.provider, req.auditContext)
  );
});

const updatePaymentStatus = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = statusSchema.parse(req.body);
  res.json(
    await paymentService.markPaymentStatus(req.user, params.id, payload.status, req.auditContext)
  );
});

const downloadInvoicePdf = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const pdf = await paymentService.buildInvoicePdf(req.user, params.id, req.auditContext);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${pdf.fileName}"`);
  res.send(pdf.buffer);
});

module.exports = {
  listPayments,
  createCheckout,
  updatePaymentStatus,
  downloadInvoicePdf,
};
