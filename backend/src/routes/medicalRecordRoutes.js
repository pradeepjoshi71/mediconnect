const express = require("express");
const medicalRecordController = require("../controllers/medicalRecordController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

// ─── Medical Records ──────────────────────────────────────────────────────────
// Patient self-access: keep roleMiddleware (patients don't have manage_records permission)
router.get("/mine", authMiddleware, roleMiddleware("patient"), medicalRecordController.listMine);

// View by patient: allow any user with view_records (doctor, patient_manager, patient)
router.get(
  "/patients/:patientId",
  authMiddleware,
  permissionMiddleware("view_records"),
  medicalRecordController.listByPatient
);

// Create consultation: only those who can manage records (doctor, hospital_admin, super_admin)
router.post(
  "/consultations",
  authMiddleware,
  permissionMiddleware("manage_records"),
  medicalRecordController.createConsultation
);

router.get("/:id/prescription-pdf", authMiddleware, medicalRecordController.downloadPrescriptionPdf);

// ─── Diagnoses ────────────────────────────────────────────────────────────────
router.get(
  "/patients/:patientId/diagnoses",
  authMiddleware,
  permissionMiddleware("view_records"),
  medicalRecordController.listDiagnoses
);
router.post(
  "/patients/:patientId/diagnoses",
  authMiddleware,
  permissionMiddleware("manage_records"),
  medicalRecordController.createDiagnosis
);
router.patch(
  "/diagnoses/:id",
  authMiddleware,
  permissionMiddleware("manage_records"),
  medicalRecordController.updateDiagnosis
);
router.delete(
  "/diagnoses/:id",
  authMiddleware,
  permissionMiddleware("manage_records"),
  medicalRecordController.deleteDiagnosis
);

// ─── Allergies ────────────────────────────────────────────────────────────────
// Reading allergies: view_records covers doctor, patient_manager, patient
router.get(
  "/patients/:patientId/allergies",
  authMiddleware,
  permissionMiddleware("view_records"),
  medicalRecordController.listAllergies
);
// Writing allergies: manage_records (doctor) OR register_patients (receptionist, patient_manager)
// Use a combined check so receptionist can still record allergies during registration
router.post(
  "/patients/:patientId/allergies",
  authMiddleware,
  (req, res, next) => {
    const perms = req.user?.permissions || [];
    const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
    const canWrite = perms.includes("manage_records") || perms.includes("register_patients");
    if (isAdminRole || canWrite) return next();
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  },
  medicalRecordController.createAllergy
);
router.patch(
  "/allergies/:id",
  authMiddleware,
  (req, res, next) => {
    const perms = req.user?.permissions || [];
    const isAdminRole = ["super_admin", "hospital_admin", "admin"].includes(req.user?.role);
    const canWrite = perms.includes("manage_records") || perms.includes("register_patients");
    if (isAdminRole || canWrite) return next();
    return res.status(403).json({ message: "Forbidden: insufficient permissions", requestId: req.requestId });
  },
  medicalRecordController.updateAllergy
);
router.delete(
  "/allergies/:id",
  authMiddleware,
  permissionMiddleware("manage_records"),
  medicalRecordController.deleteAllergy
);

module.exports = router;
