const express = require("express");
const router = express.Router();
const { getAllDoctors } = require("../controllers/doctorController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/", authMiddleware, getAllDoctors);

module.exports = router;
