const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

const allBillingRoles = ["patient", "super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"];
const readBillingRoles = ["patient", "super_admin", "hospital_admin", "admin", "billing_executive", "doctor", "receptionist"];

// Phase 3 Endpoints
router.post("/create-order", authMiddleware, roleMiddleware(...allBillingRoles), paymentController.createOrder);
router.post("/verify", authMiddleware, roleMiddleware(...allBillingRoles), paymentController.verifyPayment);
router.post("/refund", authMiddleware, roleMiddleware("super_admin", "hospital_admin", "admin", "billing_executive"), paymentController.refundPayment);
router.get("/history", authMiddleware, roleMiddleware(...readBillingRoles), paymentController.paymentHistory);

// Legacy backward-compatibility endpoints
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
