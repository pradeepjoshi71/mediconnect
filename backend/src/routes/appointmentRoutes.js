const express = require("express");
const appointmentController = require("../controllers/appointmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/", authMiddleware, appointmentController.listAppointments);
router.get("/queue", authMiddleware, appointmentController.getQueue);
router.get("/waitlist", authMiddleware, appointmentController.listWaitlist);
router.post("/", authMiddleware, appointmentController.bookAppointment);
router.post(
  "/waitlist",
  authMiddleware,
  roleMiddleware("patient", "admin", "receptionist"),
  appointmentController.createWaitlist
);
router.patch("/:id/reschedule", authMiddleware, appointmentController.rescheduleAppointment);
router.patch("/:id/status", authMiddleware, appointmentController.updateAppointmentStatus);

module.exports = router;
