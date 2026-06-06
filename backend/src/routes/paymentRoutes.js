const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { asyncHandler } = require("../middlewares/asyncHandler");
const paymentService = require("../services/paymentService");

const router = express.Router();

const allBillingRoles = ["patient", "super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"];
const readBillingRoles = ["patient", "super_admin", "hospital_admin", "admin", "billing_executive", "doctor", "receptionist"];
const adminBillingRoles = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"];

// ─── Online Payment Endpoints ───────────────────────────────────────────────
router.post("/create-order", authMiddleware, roleMiddleware(...allBillingRoles), paymentController.createOrder);
router.post("/verify", authMiddleware, roleMiddleware(...allBillingRoles), paymentController.verifyPayment);
router.post("/refund", authMiddleware, roleMiddleware("super_admin", "hospital_admin", "admin", "billing_executive"), paymentController.refundPayment);

// ─── Offline Payment Recording ──────────────────────────────────────────────
router.post("/record-offline", authMiddleware, roleMiddleware(...adminBillingRoles), paymentController.recordOfflinePayment);

// ─── History & Reports ──────────────────────────────────────────────────────
router.get("/history", authMiddleware, roleMiddleware(...readBillingRoles), paymentController.paymentHistory);

// ─── Webhook (no auth — Razorpay calls this directly) ──────────────────────
router.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    const result = await paymentService.handleWebhook(req.body, signature);
    res.json(result);
  })
);

// ─── Legacy Backward-Compatibility Endpoints ────────────────────────────────
router.get("/", authMiddleware, paymentController.listPayments);
router.post(
  "/:id/checkout",
  authMiddleware,
  roleMiddleware("patient", "admin", "receptionist"),
  paymentController.createCheckout
);
router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("patient", "admin", "receptionist"),
  paymentController.updatePaymentStatus
);
router.get("/:id/invoice-pdf", authMiddleware, paymentController.downloadInvoicePdf);

module.exports = router;
