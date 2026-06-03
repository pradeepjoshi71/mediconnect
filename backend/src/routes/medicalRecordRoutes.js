const express = require("express");
const medicalRecordController = require("../controllers/medicalRecordController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

// ─── Medical Records ──────────────────────────────────────────────────────────
router.get("/mine", authMiddleware, roleMiddleware("patient"), medicalRecordController.listMine);
router.get(
  "/patients/:patientId",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin"),
  medicalRecordController.listByPatient
);
router.post(
  "/consultations",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.createConsultation
);
router.get("/:id/prescription-pdf", authMiddleware, medicalRecordController.downloadPrescriptionPdf);

// ─── Diagnoses ────────────────────────────────────────────────────────────────
router.get(
  "/patients/:patientId/diagnoses",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "receptionist"),
  medicalRecordController.listDiagnoses
);
router.post(
  "/patients/:patientId/diagnoses",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.createDiagnosis
);
router.patch(
  "/diagnoses/:id",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.updateDiagnosis
);
router.delete(
  "/diagnoses/:id",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.deleteDiagnosis
);

// ─── Allergies ────────────────────────────────────────────────────────────────
router.get(
  "/patients/:patientId/allergies",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "receptionist"),
  medicalRecordController.listAllergies
);
router.post(
  "/patients/:patientId/allergies",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist"),
  medicalRecordController.createAllergy
);
router.patch(
  "/allergies/:id",
  authMiddleware,
  roleMiddleware("doctor", "admin", "receptionist"),
  medicalRecordController.updateAllergy
);
router.delete(
  "/allergies/:id",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.deleteAllergy
);

module.exports = router;
