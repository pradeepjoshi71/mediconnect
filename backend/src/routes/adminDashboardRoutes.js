const express = require("express");
const adminDashboardController = require("../controllers/adminDashboardController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  permissionMiddleware("view_dashboard"),
  adminDashboardController.getAdminDashboard
);

module.exports = router;
