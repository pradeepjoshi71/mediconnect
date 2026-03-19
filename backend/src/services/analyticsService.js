const analyticsRepository = require("../repositories/analyticsRepository");
const { getJson, setJson } = require("../config/redis");
const intelligenceService = require("./intelligenceService");
const { AppError } = require("../utils/http");

async function getAnalyticsOverview(user) {
  if (!["admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Analytics are restricted to operational roles");
  }

  const cacheKey = `analytics:${user.hospitalId}:overview`;
  const cached = await getJson(cacheKey);
  if (cached) {
    return cached;
  }

  const [headline, appointmentSeries, revenueSeries, doctorPerformance, statusBreakdown] =
    await Promise.all([
      analyticsRepository.getHeadlineStats(user.hospitalId),
      analyticsRepository.getAppointmentSeries(user.hospitalId),
      analyticsRepository.getRevenueSeries(user.hospitalId),
      analyticsRepository.getDoctorPerformance(user.hospitalId),
      analyticsRepository.getStatusBreakdown(user.hospitalId),
    ]);

  const predictiveInsights = await intelligenceService.getPredictiveInsights(user);

  const result = {
    headline,
    appointmentSeries,
    revenueSeries,
    doctorPerformance,
    statusBreakdown,
    predictiveInsights,
  };

  await setJson(cacheKey, result, 120);
  return result;
}

module.exports = { getAnalyticsOverview };
