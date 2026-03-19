const express = require("express");
const patientController = require("../controllers/patientController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist"),
  patientController.listPatients
);
router.get(
  "/:patientId",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin"),
  patientController.getPatientSummary
);

module.exports = router;
