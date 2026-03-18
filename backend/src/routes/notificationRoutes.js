const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const {
  listMyNotifications,
  markRead,
} = require("../controllers/notificationController");

router.get("/", authMiddleware, listMyNotifications);
router.post("/:id/read", authMiddleware, markRead);

module.exports = router;

