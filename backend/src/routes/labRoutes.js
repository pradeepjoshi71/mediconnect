const express = require("express");
const labController = require("../controllers/labController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const labTestsRouter = express.Router();
const labOrdersRouter = express.Router();
const labReportsRouter = express.Router();

// Custom authorization helpers for lab routes
const requireRecordsOrReports = (req, res, next) => {
  const permissions = req.user.permissions || [];
  const isAuthorized = permissions.includes("view_records") || 
                       permissions.includes("view_reports") || 
                       ["super_admin", "hospital_admin", "admin"].includes(req.user.role);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  }
  next();
};

const requireOrdersOrResults = (req, res, next) => {
  const permissions = req.user.permissions || [];
  const isAuthorized = permissions.includes("manage_lab_orders") || 
                       permissions.includes("manage_lab_results") || 
                       ["super_admin", "hospital_admin", "admin"].includes(req.user.role);
  if (!isAuthorized) {
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  }
  next();
};

// ─── Lab Tests Catalog Route ──────────────────────────────────────────────────
labTestsRouter.get(
  "/",
  authMiddleware,
  requireRecordsOrReports,
  labController.listLabTests
);

labTestsRouter.post(
  "/",
  authMiddleware,
  permissionMiddleware("manage_settings"),
  labController.createLabTest
);

// ─── Lab Orders Route ──────────────────────────────────────────────────────────
labOrdersRouter.get(
  "/",
  authMiddleware,
  requireOrdersOrResults,
  labController.listLabOrders
);

labOrdersRouter.post(
  "/",
  authMiddleware,
  permissionMiddleware("manage_lab_orders"),
  labController.createLabOrder
);

labOrdersRouter.patch(
  "/:id/status",
  authMiddleware,
  permissionMiddleware("manage_lab_results"),
  labController.updateLabOrderStatus
);

labOrdersRouter.get(
  "/revenue",
  authMiddleware,
  permissionMiddleware("view_analytics"),
  labController.getRevenueReports
);

const { createUploadMiddleware } = require("../utils/upload");
const upload = createUploadMiddleware();

// ─── Lab Reports Route ──────────────────────────────────────────────────────────
labReportsRouter.post(
  "/",
  authMiddleware,
  permissionMiddleware("manage_lab_results"),
  upload.single("file"),
  labController.createLabReport
);

labReportsRouter.get(
  "/download/:id",
  authMiddleware,
  requireRecordsOrReports,
  labController.downloadLabReport
);

labReportsRouter.get(
  "/:patientId",
  authMiddleware,
  requireRecordsOrReports,
  labController.listLabReports
);

labReportsRouter.get(
  "/",
  authMiddleware,
  requireRecordsOrReports,
  labController.listLabReports
);

module.exports = {
  labTestsRouter,
  labOrdersRouter,
  labReportsRouter
};
