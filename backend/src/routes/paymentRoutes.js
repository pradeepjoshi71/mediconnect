const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");
const { asyncHandler } = require("../middlewares/asyncHandler");
const paymentService = require("../services/paymentService");

const router = express.Router();

// ─── Online Payment Endpoints ───────────────────────────────────────────────
router.post("/create-order", authMiddleware, permissionMiddleware("record_payments"), paymentController.createOrder);
router.post("/verify", authMiddleware, permissionMiddleware("record_payments"), paymentController.verifyPayment);
router.post("/refund", authMiddleware, permissionMiddleware("manage_billing"), paymentController.refundPayment);

// ─── Offline Payment Recording ──────────────────────────────────────────────
router.post("/record-offline", authMiddleware, permissionMiddleware("manage_billing"), paymentController.recordOfflinePayment);

// ─── History & Reports ──────────────────────────────────────────────────────
router.get("/history", authMiddleware, permissionMiddleware("record_payments"), paymentController.paymentHistory);

// ─── Webhook (no auth — Razorpay calls this directly) ──────────────────────
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const result = await paymentService.handleWebhook(req.body, signature, req.rawBody);
    res.json(result);
  })
);

// ─── Legacy Backward-Compatibility Endpoints ────────────────────────────────
// GET / — kept for backward compat; requires same permission as /history
router.get("/", authMiddleware, permissionMiddleware("record_payments"), paymentController.listPayments);
router.post(
  "/:id/checkout",
  authMiddleware,
  permissionMiddleware("record_payments"),
  paymentController.createCheckout
);
router.patch(
  "/:id/status",
  authMiddleware,
  permissionMiddleware("manage_billing"),
  paymentController.updatePaymentStatus
);
router.get(
  "/:id/invoice-pdf",
  authMiddleware,
  permissionMiddleware("view_records"),
  paymentController.downloadInvoicePdf
);

module.exports = router;
