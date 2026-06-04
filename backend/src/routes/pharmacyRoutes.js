const express = require("express");
const pharmacyController = require("../controllers/pharmacyController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

const allRoles = ["patient", "doctor", "pharmacist", "admin", "super_admin", "hospital_admin"];
const dispenseRoles = ["pharmacist", "admin", "super_admin", "hospital_admin"];
const patientOrPharmacyRoles = ["patient", "pharmacist", "admin", "super_admin", "hospital_admin"];

router.post(
  "/dispense",
  authMiddleware,
  roleMiddleware(...dispenseRoles),
  pharmacyController.dispenseMedicine
);

router.get(
  "/prescriptions",
  authMiddleware,
  roleMiddleware(...allRoles),
  pharmacyController.listPrescriptions
);

router.get(
  "/dispensed",
  authMiddleware,
  roleMiddleware(...patientOrPharmacyRoles),
  pharmacyController.listDispensed
);

router.get(
  "/dispensed/download",
  authMiddleware,
  roleMiddleware(...patientOrPharmacyRoles),
  pharmacyController.downloadMedicationHistory
);

module.exports = router;
