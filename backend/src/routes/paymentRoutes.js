const express = require("express");
const paymentController = require("../controllers/paymentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

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
