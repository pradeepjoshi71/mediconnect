const express = require("express");
const doctorController = require("../controllers/doctorController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/", authMiddleware, doctorController.listDoctors);
router.get(
  "/me/availability",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  doctorController.getMyAvailability
);
router.put(
  "/me/availability",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  doctorController.updateMyAvailability
);
router.get(
  "/me/time-off",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  doctorController.listMyTimeOff
);
router.post(
  "/me/time-off",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  doctorController.addTimeOff
);
router.get("/:doctorId/availability", authMiddleware, doctorController.getAvailability);

module.exports = router;
