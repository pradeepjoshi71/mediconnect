const express = require("express");
const telemedicineController = require("../controllers/telemedicineController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// Get session: any authenticated user with telemedicine access
router.get(
  "/appointments/:appointmentId/session",
  authMiddleware,
  permissionMiddleware("telemedicine"),
  telemedicineController.getSession
);

// End session: telemedicine permission (doctor, patient, hospital_admin, super_admin)
router.post(
  "/appointments/:appointmentId/session/end",
  authMiddleware,
  permissionMiddleware("telemedicine"),
  telemedicineController.endSession
);

// Update notes: only those who manage records (doctor, hospital_admin, super_admin via bypass)
router.put(
  "/appointments/:appointmentId/notes",
  authMiddleware,
  permissionMiddleware("manage_records"),
  telemedicineController.updateNotes
);

// Update recording metadata: manage_records (doctor-level)
router.put(
  "/appointments/:appointmentId/recording",
  authMiddleware,
  permissionMiddleware("manage_records"),
  telemedicineController.updateRecordingMetadata
);

// Session history: telemedicine permission
router.get(
  "/history",
  authMiddleware,
  permissionMiddleware("telemedicine"),
  telemedicineController.listSessionHistory
);

// Messages: telemedicine permission
router.get(
  "/appointments/:appointmentId/messages",
  authMiddleware,
  permissionMiddleware("telemedicine"),
  telemedicineController.listMessages
);

router.post(
  "/appointments/:appointmentId/messages",
  authMiddleware,
  permissionMiddleware("telemedicine"),
  telemedicineController.sendMessage
);

module.exports = router;
