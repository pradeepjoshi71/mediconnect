const express = require("express");
const patientController = require("../controllers/patientController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  permissionMiddleware("view_patients"),
  patientController.listPatients
);

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("register_patients"),
  patientController.createPatient
);

router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("register_patients"),
  patientController.updatePatient
);

router.get(
  "/:id",
  authMiddleware,
  permissionMiddleware("view_records"),
  patientController.getPatientSummary
);

module.exports = router;
