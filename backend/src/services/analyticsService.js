const analyticsRepository = require("../repositories/analyticsRepository");
const { AppError } = require("../utils/http");

async function getAnalyticsOverview(user) {
  if (!["admin", "receptionist"].includes(user.role)) {
    throw new AppError(403, "Analytics are restricted to operational roles");
  }

  const [headline, appointmentSeries, revenueSeries, doctorPerformance, statusBreakdown] =
    await Promise.all([
      analyticsRepository.getHeadlineStats(),
      analyticsRepository.getAppointmentSeries(),
      analyticsRepository.getRevenueSeries(),
      analyticsRepository.getDoctorPerformance(),
      analyticsRepository.getStatusBreakdown(),
    ]);

  return {
    headline,
    appointmentSeries,
    revenueSeries,
    doctorPerformance,
    statusBreakdown,
  };
}

module.exports = { getAnalyticsOverview };
