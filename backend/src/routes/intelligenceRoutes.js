const express = require("express");
const intelligenceController = require("../controllers/intelligenceController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/doctor-recommendations", authMiddleware, intelligenceController.getDoctorRecommendations);
router.post("/symptom-check", authMiddleware, intelligenceController.runSymptomCheck);
router.get("/follow-ups", authMiddleware, intelligenceController.getFollowUpReminders);
router.get("/predictive-insights", authMiddleware, intelligenceController.getPredictiveInsights);

module.exports = router;
