const express = require("express");
const telemedicineController = require("../controllers/telemedicineController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get(
  "/appointments/:appointmentId/session",
  authMiddleware,
  telemedicineController.getSession
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
