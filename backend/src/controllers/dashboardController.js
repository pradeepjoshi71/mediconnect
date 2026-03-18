const dashboardService = require("../services/dashboardService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const getDashboard = asyncHandler(async (req, res) => {
  res.json(await dashboardService.getDashboard(req.user));
});

module.exports = { getDashboard };
