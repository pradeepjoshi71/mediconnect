const express = require("express");
const adminDashboardController = require("../controllers/adminDashboardController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get(
  "/dashboard",
  authMiddleware,
  roleMiddleware("hospital_admin", "super_admin", "admin"),
  adminDashboardController.getAdminDashboard
);

module.exports = router;
