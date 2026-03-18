const express = require("express");
const router = express.Router();
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const {
  getMyRules,
  setMyRules,
  addTimeOff,
  listTimeOff,
  getDoctorSlots,
} = require("../controllers/availabilityController");

// Public-ish (authenticated) slot view for booking UI
router.get("/doctors/:doctorId/slots", authMiddleware, getDoctorSlots);

// Doctor manages own availability
router.get("/me/rules", authMiddleware, roleMiddleware("doctor", "admin"), getMyRules);
router.put("/me/rules", authMiddleware, roleMiddleware("doctor", "admin"), setMyRules);
router.get("/me/time-off", authMiddleware, roleMiddleware("doctor", "admin"), listTimeOff);
router.post("/me/time-off", authMiddleware, roleMiddleware("doctor", "admin"), addTimeOff);

module.exports = router;

