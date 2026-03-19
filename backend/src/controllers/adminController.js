const { z } = require("zod");
const adminService = require("../services/adminService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createStaffSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  phone: z.string().max(24).optional(),
  role: z.enum(["doctor", "receptionist"]),
  specialization: z.string().max(120).optional(),
  department: z.string().max(120).optional(),
  employeeCode: z.string().max(40).optional(),
  licenseNumber: z.string().max(80).optional(),
  experienceYears: z.number().int().min(0).max(80).optional(),
  consultationFeeCents: z.number().int().min(0).optional(),
});

const auditLogQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  action: z.string().max(120).optional(),
  userId: z.coerce.number().int().positive().optional(),
});

const listUsers = asyncHandler(async (req, res) => {
  res.json(await adminService.listUsers(req.user));
});

const createStaffUser = asyncHandler(async (req, res) => {
  const payload = createStaffSchema.parse(req.body);
  const result = await adminService.createStaffUser(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const getHospitalSummary = asyncHandler(async (req, res) => {
  res.json(await adminService.getHospitalSummary(req.user));
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const query = auditLogQuery.parse(req.query);
  res.json(await adminService.listAuditLogs(req.user, query));
});

module.exports = {
  listUsers,
  createStaffUser,
  getHospitalSummary,
  listAuditLogs,
};
