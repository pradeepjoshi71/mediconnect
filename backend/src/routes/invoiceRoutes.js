const express = require("express");
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

const adminRoles = ["super_admin", "hospital_admin", "admin", "billing_executive", "receptionist"];
const readRoles = ["super_admin", "hospital_admin", "admin", "billing_executive", "doctor", "patient", "receptionist"];

router.get("/", authMiddleware, roleMiddleware(...readRoles), invoiceController.listInvoices);
router.get("/reports/revenue", authMiddleware, roleMiddleware("super_admin", "hospital_admin", "admin", "billing_executive"), invoiceController.getRevenueReports);
router.get("/:id", authMiddleware, roleMiddleware(...readRoles), invoiceController.getInvoiceById);

router.post("/", authMiddleware, roleMiddleware(...adminRoles), invoiceController.createInvoice);
router.put("/:id", authMiddleware, roleMiddleware(...adminRoles), invoiceController.updateInvoice);
router.delete("/:id", authMiddleware, roleMiddleware(...adminRoles), invoiceController.cancelInvoice);

module.exports = router;
