const { z } = require("zod");
const doctorService = require("../services/doctorService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const listDoctorsQuery = z.object({
  search: z.string().optional().default(""),
  specialization: z.string().optional().default(""),
  minExperience: z.coerce.number().int().min(0).optional().default(0),
  minRating: z.coerce.number().min(0).max(5).optional().default(0),
  sort: z.enum(["rating", "experience", "fee"]).optional().default("rating"),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
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

const createDoctorSchema = z.object({
  employee_id: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(24).optional(),
  specialization: z.string().trim().min(2).max(120),
  qualification: z.string().trim().min(2).max(255),
  years_experience: z.coerce.number().int().min(0),
  consultation_fee: z.coerce.number().min(0),
  department: z.string().trim().min(1).max(120).optional().default("General"),
  biography: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  availability_status: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional(),
  password: z.string().min(8).optional(),
  license_number: z.string().trim().optional(),
});

const updateDoctorSchema = z.object({
  employee_id: z.string().trim().min(1).max(40),
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(24).optional(),
  specialization: z.string().trim().min(2).max(120),
  qualification: z.string().trim().min(2).max(255),
  years_experience: z.coerce.number().int().min(0),
  consultation_fee: z.coerce.number().min(0),
  department: z.string().trim().min(1).max(120).optional().default("General"),
  biography: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  availability_status: z.enum(["AVAILABLE", "UNAVAILABLE"]).optional(),
  license_number: z.string().trim().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(["active", "inactive"]),
});

const listDoctors = asyncHandler(async (req, res) => {
  const query = listDoctorsQuery.parse(req.query);
  const isAdmin = ["super_admin", "hospital_admin", "admin"].includes(req.user.role);
  const doctors = await doctorService.listDoctors(req.user, {
    ...query,
    includeInactive: isAdmin ? true : false,
  });
  res.json(doctors);
});

const getDoctorById = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const doctor = await doctorService.getDoctorById(req.user, params.id);
  res.json(doctor);
});

const createDoctor = asyncHandler(async (req, res) => {
  if (req.body.availability_status) {
    req.body.status = req.body.availability_status === "AVAILABLE" ? "active" : "inactive";
  }
  const payload = createDoctorSchema.parse(req.body);
  const doctor = await doctorService.createDoctor(req.user, payload, req.auditContext);
  res.status(201).json(doctor);
});

const updateDoctor = asyncHandler(async (req, res) => {
  if (req.body.availability_status) {
    req.body.status = req.body.availability_status === "AVAILABLE" ? "active" : "inactive";
  }
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateDoctorSchema.parse(req.body);
  const doctor = await doctorService.updateDoctor(req.user, params.id, payload, req.auditContext);
  res.json(doctor);
});

const updateDoctorStatus = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateStatusSchema.parse(req.body);
  const result = await doctorService.updateDoctorStatus(req.user, params.id, payload.status, req.auditContext);
  res.json(result);
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

const updateDoctorAvailability = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const updateAvailabilitySchema = z.object({
    availability_status: z.enum(["AVAILABLE", "UNAVAILABLE"]),
  });
  const payload = updateAvailabilitySchema.parse(req.body);
  const status = payload.availability_status === "AVAILABLE" ? "active" : "inactive";
  
  await doctorService.updateDoctorStatus(req.user, params.id, status, req.auditContext);
  res.json({
    id: params.id,
    availability_status: payload.availability_status,
  });
});

module.exports = {
  listDoctors,
  getAvailability,
  getMyAvailability,
  updateMyAvailability,
  listMyTimeOff,
  addTimeOff,
  getDoctorById,
  createDoctor,
  updateDoctor,
  updateDoctorStatus,
  updateDoctorAvailability,
};
