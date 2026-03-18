const express = require("express");
const adminController = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

const router = express.Router();

router.get("/users", authMiddleware, roleMiddleware("admin"), adminController.listUsers);
router.post("/staff", authMiddleware, roleMiddleware("admin"), adminController.createStaffUser);

module.exports = router;
