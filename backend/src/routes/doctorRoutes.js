const express = require("express");
const doctorController = require("../controllers/doctorController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// Public/authenticated doctors list
router.get("/", authMiddleware, doctorController.listDoctors);

// Manage doctors (Super Admin and Hospital Admin only)
router.post(
  "/",
  authMiddleware,
  roleMiddleware("super_admin", "hospital_admin"),
  doctorController.createDoctor
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("super_admin", "hospital_admin"),
  doctorController.updateDoctor
);

router.patch(
  "/:id/status",
  authMiddleware,
  roleMiddleware("super_admin", "hospital_admin"),
  doctorController.updateDoctorStatus
);

router.patch(
  "/:id/availability",
  authMiddleware,
  roleMiddleware("super_admin", "hospital_admin"),
  doctorController.updateDoctorAvailability
);

// Doctor availability rules (own)
router.get(
  "/me/availability",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist", "super_admin", "hospital_admin"),
  doctorController.getMyAvailability
);

router.put(
  "/me/availability",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist", "super_admin", "hospital_admin"),
  doctorController.updateMyAvailability
);

// Doctor time-off (own)
router.get(
  "/me/time-off",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist", "super_admin", "hospital_admin"),
  doctorController.listMyTimeOff
);

router.post(
  "/me/time-off",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist", "super_admin", "hospital_admin"),
  doctorController.addTimeOff
);

// Doctor specific availability details
router.get("/:doctorId/availability", authMiddleware, doctorController.getAvailability);

// Get doctor by ID
router.get("/:id", authMiddleware, doctorController.getDoctorById);

module.exports = router;
