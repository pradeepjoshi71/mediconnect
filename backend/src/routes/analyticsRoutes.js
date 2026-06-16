const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// Allow any user with view_analytics permission (report_admin, billing_admin, hospital_admin, super_admin, admin)
router.get("/", authMiddleware, permissionMiddleware("view_analytics"), analyticsController.getOverview);

module.exports = router;
