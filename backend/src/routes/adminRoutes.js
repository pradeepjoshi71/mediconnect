const express = require("express");
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// List users and hospital summary: manage_settings (hospital_admin, super_admin, admin)
router.get("/users", authMiddleware, permissionMiddleware("manage_settings"), adminController.listUsers);
router.get("/hospital", authMiddleware, permissionMiddleware("manage_settings"), adminController.getHospitalSummary);

// Audit logs: view_analytics permission (report_admin, hospital_admin, super_admin, admin)
router.get("/audit-logs", authMiddleware, permissionMiddleware("view_analytics"), adminController.listAuditLogs);

// Create staff: manage_settings (hospital_admin, super_admin, admin)
router.post("/staff", authMiddleware, permissionMiddleware("manage_settings"), adminController.createStaffUser);

module.exports = router;
