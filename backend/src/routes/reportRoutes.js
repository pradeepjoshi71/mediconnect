const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");
const { createUploadMiddleware } = require("../utils/upload");
const { listMyReports, createReport, downloadReport } = require("../controllers/reportController");

const upload = createUploadMiddleware();

// List own reports: view_records (patient, doctor, patient_manager) or view_reports (report_admin, lab_admin)
router.get(
  "/",
  authMiddleware,
  (req, res, next) => {
    const perms = req.user?.permissions || [];
    const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
    const canView = perms.includes("view_records") || perms.includes("view_reports");
    if (isAdminRole || canView) return next();
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  },
  listMyReports
);

// Upload a report: view_reports (report_admin, lab_admin) or manage_records (doctor)
router.post(
  "/upload",
  authMiddleware,
  (req, res, next) => {
    const perms = req.user?.permissions || [];
    const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
    const canUpload = perms.includes("view_reports") || perms.includes("manage_records");
    if (isAdminRole || canUpload) return next();
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  },
  upload.single("file"),
  createReport
);

// Download a report: view_records or view_reports
router.get(
  "/:id/download",
  authMiddleware,
  (req, res, next) => {
    const perms = req.user?.permissions || [];
    const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
    const canView = perms.includes("view_records") || perms.includes("view_reports");
    if (isAdminRole || canView) return next();
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  },
  downloadReport
);

module.exports = router;
