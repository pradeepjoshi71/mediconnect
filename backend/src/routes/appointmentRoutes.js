const express = require("express");
const router = express.Router();
const {
  bookAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  updateStatus,
} = require("../controllers/appointmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.get("/mine", authMiddleware, listMyAppointments);
router.post("/", authMiddleware, roleMiddleware("patient", "admin"), bookAppointment);
router.post(
  "/:id/cancel",
  authMiddleware,
  roleMiddleware("patient", "admin"),
  cancelAppointment
);
router.post(
  "/:id/reschedule",
  authMiddleware,
  roleMiddleware("patient", "admin"),
  rescheduleAppointment
);
router.post(
  "/:id/status",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  updateStatus
);

module.exports = router;
