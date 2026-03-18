const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const { createUploadMiddleware } = require("../utils/upload");
const { listMyReports, createReport, downloadReport } = require("../controllers/reportController");

const upload = createUploadMiddleware();

router.get("/", authMiddleware, listMyReports);
router.post(
  "/upload",
  authMiddleware,
  roleMiddleware("patient", "doctor", "admin"),
  upload.single("file"),
  createReport
);
router.get("/:id/download", authMiddleware, downloadReport);

module.exports = router;

