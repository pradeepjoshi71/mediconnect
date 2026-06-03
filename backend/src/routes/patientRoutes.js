const express = require("express");
const patientController = require("../controllers/patientController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist", "super_admin", "hospital_admin"),
  patientController.listPatients
);

router.post(
  "/",
  authMiddleware,
  roleMiddleware("admin", "super_admin", "hospital_admin", "receptionist"),
  patientController.createPatient
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("admin", "super_admin", "hospital_admin", "doctor", "receptionist"),
  patientController.updatePatient
);

router.get(
  "/:patientId",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "super_admin", "hospital_admin"),
  patientController.getPatientSummary
);

module.exports = router;
