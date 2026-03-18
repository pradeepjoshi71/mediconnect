const express = require("express");
const router = express.Router();
const {
  getAllUsers,
  getAllAppointments,
  createDoctor,
} = require("../controllers/adminController");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");

router.get("/users", authMiddleware, roleMiddleware("admin"), getAllUsers);
router.get("/appointments", authMiddleware, roleMiddleware("admin"), getAllAppointments);
router.post("/doctors", authMiddleware, roleMiddleware("admin"), createDoctor);

module.exports = router;
