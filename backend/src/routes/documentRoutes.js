const express = require("express");
const documentController = require("../controllers/documentController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { createUploadMiddleware } = require("../utils/upload");

const router = express.Router();
const upload = createUploadMiddleware();

router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("doctor", "admin", "super_admin", "hospital_admin"),
  upload.single("file"),
  documentController.uploadDocument
);

router.get(
  "/:patientId",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "super_admin", "hospital_admin"),
  documentController.listDocuments
);

router.get(
  "/:id/download",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin", "super_admin", "hospital_admin"),
  documentController.downloadDocument
);

module.exports = router;
