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

const listUsers = asyncHandler(async (_req, res) => {
  res.json(await adminService.listUsers());
});

const createStaffUser = asyncHandler(async (req, res) => {
  const payload = createStaffSchema.parse(req.body);
  const result = await adminService.createStaffUser(payload);
  res.status(201).json(result);
});

module.exports = {
  listUsers,
  createStaffUser,
};
