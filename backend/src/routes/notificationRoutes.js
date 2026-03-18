const express = require("express");
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, notificationController.listNotifications);
router.post("/:id/read", authMiddleware, notificationController.markRead);
router.post("/read-all", authMiddleware, notificationController.markAllRead);

module.exports = router;
