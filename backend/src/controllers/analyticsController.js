const analyticsService = require("../services/analyticsService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getOverview = asyncHandler(async (req, res) => {
  res.json(await analyticsService.getAnalyticsOverview(req.user));
});

module.exports = { getOverview };
