const express = require("express");
const recordController = require("../controllers/recordController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get(
  "/:patientId",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "super_admin", "hospital_admin"),
  recordController.getMedicalHistory
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("doctor", "admin", "super_admin", "hospital_admin"),
  recordController.createMedicalRecord
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("doctor", "admin", "super_admin", "hospital_admin"),
  recordController.updateMedicalRecord
);

module.exports = router;
