const express = require("express");
const invoiceController = require("../controllers/invoiceController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// Read invoices: record_payments (receptionist, billing_admin, patient) or view_records (doctor, patient)
// Use a combined check to cover all existing read-capable roles
const canReadInvoice = (req, res, next) => {
  const perms = req.user?.permissions || [];
  const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
  const hasAccess = perms.includes("record_payments") || perms.includes("view_records") || perms.includes("manage_billing");
  if (isAdminRole || hasAccess) return next();
  return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
};

router.get("/", authMiddleware, canReadInvoice, invoiceController.listInvoices);
router.get("/reports/revenue", authMiddleware, permissionMiddleware("view_analytics"), invoiceController.getRevenueReports);
router.get("/:id", authMiddleware, canReadInvoice, invoiceController.getInvoiceById);

// Write invoices: manage_billing (billing_admin, hospital_admin, super_admin)
router.post("/", authMiddleware, permissionMiddleware("manage_billing"), invoiceController.createInvoice);
router.put("/:id", authMiddleware, permissionMiddleware("manage_billing"), invoiceController.updateInvoice);
router.delete("/:id", authMiddleware, permissionMiddleware("manage_billing"), invoiceController.cancelInvoice);

module.exports = router;
