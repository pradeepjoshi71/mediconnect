const { z } = require("zod");
const patientService = require("../services/patientService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createPatientSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(24).optional(),
  gender: z.enum(["male", "female", "other", "undisclosed"]).optional().default("undisclosed"),
  date_of_birth: z.string().date().optional(),
  blood_group: z.string().max(5).optional(),
  address: z.string().optional(),
  emergency_contact_name: z.string().max(120).optional(),
  emergency_contact_phone: z.string().max(24).optional(),
  insurance_provider: z.string().max(120).optional(),
  insurance_policy_number: z.string().max(80).optional(),
  password: z.string().min(8).optional(),
});

const updatePatientSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().max(24).optional().nullable(),
  gender: z.enum(["male", "female", "other", "undisclosed"]).optional().default("undisclosed"),
  date_of_birth: z.string().date().optional().nullable(),
  blood_group: z.string().max(5).optional().nullable(),
  address: z.string().optional().nullable(),
  emergency_contact_name: z.string().max(120).optional().nullable(),
  emergency_contact_phone: z.string().max(24).optional().nullable(),
  insurance_provider: z.string().max(120).optional().nullable(),
  insurance_policy_number: z.string().max(80).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

const listPatients = asyncHandler(async (req, res) => {
  const query = z.object({ search: z.string().optional().default("") }).parse(req.query);
  res.json(await patientService.listPatients(req.user, query.search));
});

const getPatientSummary = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  res.json(await patientService.getPatientSummary(req.user, params.id, req.auditContext));
});

const createPatient = asyncHandler(async (req, res) => {
  const payload = createPatientSchema.parse(req.body);
  const patient = await patientService.createPatient(req.user, payload, req.auditContext);
  res.status(201).json(patient);
});

const updatePatient = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updatePatientSchema.parse(req.body);
  const patient = await patientService.updatePatient(req.user, params.id, payload, req.auditContext);
  res.json(patient);
});

module.exports = {
  listPatients,
  getPatientSummary,
  createPatient,
  updatePatient,
};
