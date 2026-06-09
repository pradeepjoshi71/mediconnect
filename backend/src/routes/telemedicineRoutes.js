const express = require("express");
const telemedicineController = require("../controllers/telemedicineController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get(
  "/appointments/:appointmentId/session",
  authMiddleware,
  telemedicineController.getSession
);

router.post(
  "/appointments/:appointmentId/session/end",
  authMiddleware,
  telemedicineController.endSession
);

router.put(
  "/appointments/:appointmentId/notes",
  authMiddleware,
  roleMiddleware("doctor", "admin", "super_admin", "hospital_admin"),
  telemedicineController.updateNotes
);

router.put(
  "/appointments/:appointmentId/recording",
  authMiddleware,
  roleMiddleware("doctor", "admin", "super_admin", "hospital_admin"),
  telemedicineController.updateRecordingMetadata
);

router.get(
  "/history",
  authMiddleware,
  telemedicineController.listSessionHistory
);

router.get(
  "/appointments/:appointmentId/messages",
  authMiddleware,
  telemedicineController.listMessages
);

router.post(
  "/appointments/:appointmentId/messages",
  authMiddleware,
  telemedicineController.sendMessage
);

module.exports = router;
