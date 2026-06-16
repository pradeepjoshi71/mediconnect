const express = require("express");
const recordController = require("../controllers/recordController");
const authMiddleware = require("../middlewares/authMiddleware");
const permissionMiddleware = require("../middlewares/permissionMiddleware");

const router = express.Router();

router.get(
  "/:patientId",
  authMiddleware,
  permissionMiddleware("view_records"),
  recordController.getMedicalHistory
);

router.post(
  "/",
  authMiddleware,
  permissionMiddleware("manage_records"),
  recordController.createMedicalRecord
);

router.put(
  "/:id",
  authMiddleware,
  permissionMiddleware("manage_records"),
  recordController.updateMedicalRecord
);

module.exports = router;
