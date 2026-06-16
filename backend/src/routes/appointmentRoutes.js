const express = require("express");
const appointmentController = require("../controllers/appointmentController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// List appointments: any user with view_appointments (doctor, patient, receptionist, patient_manager, etc.)
router.get("/", authMiddleware, permissionMiddleware("view_appointments"), appointmentController.listAppointments);

// Queue and waitlist views: same as list
router.get("/queue", authMiddleware, permissionMiddleware("view_appointments"), appointmentController.getQueue);
router.get("/waitlist", authMiddleware, permissionMiddleware("view_appointments"), appointmentController.listWaitlist);

// Book appointment: any user with manage_appointments (patient, receptionist, patient_manager, hospital_admin)
router.post("/", authMiddleware, permissionMiddleware("manage_appointments"), appointmentController.bookAppointment);

// Add to waitlist: manage_appointments covers patient, patient_manager, receptionist
router.post(
  "/waitlist",
  authMiddleware,
  permissionMiddleware("manage_appointments"),
  appointmentController.createWaitlist
);

// Reschedule and status update: manage_appointments (receptionist, patient_manager) or manage_records (doctor)
router.patch(
  "/:id/reschedule",
  authMiddleware,
  permissionMiddleware("manage_appointments"),
  appointmentController.rescheduleAppointment
);
router.patch(
  "/:id/status",
  authMiddleware,
  permissionMiddleware("manage_appointments"),
  appointmentController.updateAppointmentStatus
);

module.exports = router;
