const express = require("express");
const fileController = require("../controllers/fileController");
const authMiddleware = require("../middlewares/authMiddleware");
const { createUploadMiddleware } = require("../utils/upload");

const router = express.Router();
const upload = createUploadMiddleware();

router.get("/", authMiddleware, fileController.listFiles);
router.post("/", authMiddleware, upload.single("file"), fileController.uploadFile);
router.get("/:id/download", authMiddleware, fileController.downloadFile);

module.exports = router;
