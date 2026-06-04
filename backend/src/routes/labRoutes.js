const express = require("express");
const labController = require("../controllers/labController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const labTestsRouter = express.Router();
const labOrdersRouter = express.Router();
const labReportsRouter = express.Router();

const allRoles = ["patient", "doctor", "lab_technician", "admin", "super_admin", "hospital_admin", "receptionist"];
const clinicianOrAdmin = ["doctor", "admin", "super_admin", "hospital_admin"];
const labStaffOrAdmin = ["lab_technician", "admin", "super_admin", "hospital_admin"];
const adminRoles = ["admin", "super_admin", "hospital_admin"];

// ─── Lab Tests Catalog Route ──────────────────────────────────────────────────
labTestsRouter.get(
  "/",
  authMiddleware,
  roleMiddleware(...allRoles),
  labController.listLabTests
);

labTestsRouter.post(
  "/",
  authMiddleware,
  roleMiddleware(...adminRoles),
  labController.createLabTest
);

// ─── Lab Orders Route ──────────────────────────────────────────────────────────
labOrdersRouter.get(
  "/",
  authMiddleware,
  roleMiddleware(...allRoles),
  labController.listLabOrders
);

labOrdersRouter.post(
  "/",
  authMiddleware,
  roleMiddleware(...clinicianOrAdmin),
  labController.createLabOrder
);

labOrdersRouter.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware(...labStaffOrAdmin, "receptionist"),
  labController.updateLabOrderStatus
);

labOrdersRouter.get(
  "/revenue",
  authMiddleware,
  roleMiddleware(...adminRoles),
  labController.getRevenueReports
);

const { createUploadMiddleware } = require("../utils/upload");
const upload = createUploadMiddleware();

// ─── Lab Reports Route ──────────────────────────────────────────────────────────
labReportsRouter.post(
  "/",
  authMiddleware,
  roleMiddleware(...labStaffOrAdmin),
  upload.single("file"),
  labController.createLabReport
);

labReportsRouter.get(
  "/download/:id",
  authMiddleware,
  roleMiddleware(...allRoles),
  labController.downloadLabReport
);

labReportsRouter.get(
  "/:patientId",
  authMiddleware,
  roleMiddleware(...allRoles),
  labController.listLabReports
);

labReportsRouter.get(
  "/",
  authMiddleware,
  roleMiddleware(...allRoles),
  labController.listLabReports
);

module.exports = {
  labTestsRouter,
  labOrdersRouter,
  labReportsRouter
};
