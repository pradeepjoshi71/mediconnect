const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { createCheckout, listMyPayments, markPaid } = require("../controllers/paymentController");

router.get("/", authMiddleware, listMyPayments);
router.post("/checkout", authMiddleware, roleMiddleware("patient", "admin"), createCheckout);
router.post("/:id/mark-paid", authMiddleware, roleMiddleware("patient", "admin"), markPaid);

module.exports = router;

