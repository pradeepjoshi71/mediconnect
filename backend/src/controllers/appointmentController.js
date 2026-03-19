const { z } = require("zod");
const appointmentService = require("../services/appointmentService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const bookingSchema = z.object({
  patientId: z.number().int().positive().optional(),
  doctorId: z.number().int().positive(),
  startsAt: z.string().datetime().optional(),
  reason: z.string().max(500).optional(),
  appointmentType: z
    .enum(["consultation", "follow_up", "lab_review", "vaccination"])
    .optional()
    .default("consultation"),
  consultationMode: z.enum(["in_person", "telemedicine"]).optional().default("in_person"),
  priority: z.enum(["routine", "urgent", "emergency"]).optional().default("routine"),
  waitingListRequested: z.boolean().optional().default(false),
});

const listSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.string().optional(),
});

const rescheduleSchema = z.object({
  startsAt: z.string().datetime(),
});

const statusSchema = z.object({
  status: z.enum([
    "scheduled",
    "confirmed",
    "checked_in",
    "in_consultation",
    "completed",
    "cancelled",
    "no_show",
  ]),
  cancellationReason: z.string().max(500).optional(),
});

const waitlistSchema = z.object({
  patientId: z.number().int().positive().optional(),
  doctorId: z.number().int().positive(),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferredWindow: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  priority: z.enum(["routine", "urgent", "emergency"]).optional().default("routine"),
  reason: z.string().max(500).optional(),
});

const bookAppointment = asyncHandler(async (req, res) => {
  const payload = bookingSchema.parse(req.body);
  const result = await appointmentService.bookAppointment(req.user, payload, req.auditContext);
  res.status(result.waitlist ? 202 : 201).json(result);
});

const listAppointments = asyncHandler(async (req, res) => {
  const filters = listSchema.parse(req.query);
  res.json(await appointmentService.listAppointments(req.user, filters));
});

const getQueue = asyncHandler(async (req, res) => {
  const filters = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).parse(
    req.query
  );
  res.json(await appointmentService.listQueue(req.user, filters));
});

const rescheduleAppointment = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = rescheduleSchema.parse(req.body);
  res.json(
    await appointmentService.rescheduleAppointment(
      req.user,
      params.id,
      payload.startsAt,
      req.auditContext
    )
  );
});

const updateAppointmentStatus = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = statusSchema.parse(req.body);
  res.json(
    await appointmentService.updateAppointmentStatus(
      req.user,
      params.id,
      payload,
      req.auditContext
    )
  );
});

const createWaitlist = asyncHandler(async (req, res) => {
  const payload = waitlistSchema.parse(req.body);
  const result = await appointmentService.createWaitlist(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const listWaitlist = asyncHandler(async (req, res) => {
  res.json(await appointmentService.listWaitlist(req.user));
});

module.exports = {
  bookAppointment,
  listAppointments,
  getQueue,
  rescheduleAppointment,
  updateAppointmentStatus,
  createWaitlist,
  listWaitlist,
};
