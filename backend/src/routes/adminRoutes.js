const express = require("express");
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/users", authMiddleware, roleMiddleware("admin"), adminController.listUsers);
router.get("/hospital", authMiddleware, roleMiddleware("admin"), adminController.getHospitalSummary);
router.get("/audit-logs", authMiddleware, roleMiddleware("admin"), adminController.listAuditLogs);
router.post("/staff", authMiddleware, roleMiddleware("admin"), adminController.createStaffUser);

module.exports = router;
