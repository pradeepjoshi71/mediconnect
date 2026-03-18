const express = require("express");
const medicalRecordController = require("../controllers/medicalRecordController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/mine", authMiddleware, roleMiddleware("patient"), medicalRecordController.listMine);
router.get("/patients/:patientId", authMiddleware, medicalRecordController.listByPatient);
router.post(
  "/consultations",
  authMiddleware,
  roleMiddleware("doctor", "admin"),
  medicalRecordController.createConsultation
);
router.get("/:id/prescription-pdf", authMiddleware, medicalRecordController.downloadPrescriptionPdf);

module.exports = router;
