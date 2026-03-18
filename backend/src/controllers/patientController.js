const { z } = require("zod");
const patientService = require("../services/patientService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const listPatients = asyncHandler(async (req, res) => {
  const query = z.object({ search: z.string().optional().default("") }).parse(req.query);
  res.json(await patientService.listPatients(req.user, query.search));
});

const getPatientSummary = asyncHandler(async (req, res) => {
  const params = z.object({ patientId: z.coerce.number().int().positive() }).parse(req.params);
  res.json(await patientService.getPatientSummary(req.user, params.patientId));
});

module.exports = {
  listPatients,
  getPatientSummary,
};
