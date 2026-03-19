const { z } = require("zod");
const doctorService = require("../services/doctorService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const listDoctorsQuery = z.object({
  search: z.string().optional().default(""),
  specialization: z.string().optional().default(""),
  minExperience: z.coerce.number().int().min(0).optional().default(0),
  minRating: z.coerce.number().min(0).max(5).optional().default(0),
  sort: z.enum(["rating", "experience", "fee"]).optional().default("rating"),
});

const availabilityQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const availabilityRulesSchema = z.object({
  rules: z.array(
    z.object({
      weekday: z.number().int().min(0).max(6),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      slotMinutes: z.number().int().refine((value) => [15, 20, 30, 45, 60].includes(value)),
    })
  ),
});

const timeOffSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  reason: z.string().max(400).optional(),
});

const listDoctors = asyncHandler(async (req, res) => {
  const query = listDoctorsQuery.parse(req.query);
  const doctors = await doctorService.listDoctors(req.user, query);
  res.json(doctors);
});

const getAvailability = asyncHandler(async (req, res) => {
  const params = z.object({ doctorId: z.coerce.number().int().positive() }).parse(req.params);
  const query = availabilityQuery.parse(req.query);
  const result = await doctorService.getAvailabilityForDate(req.user, params.doctorId, query.date);
  res.json(result);
});

const getMyAvailability = asyncHandler(async (req, res) => {
  res.json(await doctorService.listMyAvailability(req.user));
});

const updateMyAvailability = asyncHandler(async (req, res) => {
  const payload = availabilityRulesSchema.parse(req.body);
  await doctorService.updateMyAvailability(req.user, payload.rules, req.auditContext);
  res.status(204).send();
});

const listMyTimeOff = asyncHandler(async (req, res) => {
  res.json(await doctorService.listMyTimeOff(req.user));
});

const addTimeOff = asyncHandler(async (req, res) => {
  const payload = timeOffSchema.parse(req.body);
  const result = await doctorService.addTimeOff(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

module.exports = {
  listDoctors,
  getAvailability,
  getMyAvailability,
  updateMyAvailability,
  listMyTimeOff,
  addTimeOff,
};
