const { z } = require("zod");
const intelligenceService = require("../services/intelligenceService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const recommendationQuery = z.object({
  search: z.string().optional().default(""),
  careNeed: z.string().max(200).optional().default(""),
  specialization: z.string().max(120).optional().default(""),
  minExperience: z.coerce.number().int().min(0).optional().default(0),
  minRating: z.coerce.number().min(0).max(5).optional().default(0),
  symptoms: z
    .string()
    .optional()
    .transform((value) =>
      String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    ),
});

const symptomCheckSchema = z.object({
  careNeed: z.string().max(200).optional().default(""),
  symptoms: z.array(z.string().min(2).max(120)).min(1),
  severity: z.enum(["mild", "moderate", "severe"]).default("mild"),
  durationDays: z.number().int().min(0).max(365).optional(),
});

const getDoctorRecommendations = asyncHandler(async (req, res) => {
  const query = recommendationQuery.parse(req.query);
  res.json(await intelligenceService.getDoctorRecommendations(req.user, query, req.auditContext));
});

const runSymptomCheck = asyncHandler(async (req, res) => {
  const payload = symptomCheckSchema.parse(req.body);
  res.json(await intelligenceService.runSymptomCheck(req.user, payload, req.auditContext));
});

const getFollowUpReminders = asyncHandler(async (req, res) => {
  res.json(await intelligenceService.getFollowUpReminders(req.user));
});

const getPredictiveInsights = asyncHandler(async (req, res) => {
  res.json(await intelligenceService.getPredictiveInsights(req.user));
});

module.exports = {
  getDoctorRecommendations,
  runSymptomCheck,
  getFollowUpReminders,
  getPredictiveInsights,
};
