const { z } = require("zod");
const departmentService = require("../services/departmentService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createDepartmentSchema = z.object({
  code: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().optional(),
  headUserId: z.number().int().positive().optional().nullable(),
});

const updateDepartmentSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().optional().nullable(),
  headUserId: z.number().int().positive().optional().nullable(),
});

const addMemberSchema = z.object({
  userId: z.number().int().positive(),
});

const listDepartments = asyncHandler(async (req, res) => {
  const list = await departmentService.listDepartments(req.user);
  res.json(list);
});

const getDepartmentById = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const dept = await departmentService.getDepartment(req.user, params.id);
  res.json(dept);
});

const createDepartment = asyncHandler(async (req, res) => {
  const payload = createDepartmentSchema.parse(req.body);
  const dept = await departmentService.createDepartment(req.user, payload, req.auditContext);
  res.status(201).json(dept);
});

const updateDepartment = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateDepartmentSchema.parse(req.body);
  const dept = await departmentService.updateDepartment(req.user, params.id, payload, req.auditContext);
  res.json(dept);
});

const deleteDepartment = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const result = await departmentService.deleteDepartment(req.user, params.id, req.auditContext);
  res.json(result);
});

const addDepartmentMember = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = addMemberSchema.parse(req.body);
  const result = await departmentService.addDepartmentMember(req.user, params.id, payload.userId, req.auditContext);
  res.status(201).json(result);
});

const removeDepartmentMember = asyncHandler(async (req, res) => {
  const params = z.object({
    id: z.coerce.number().int().positive(),
    userId: z.coerce.number().int().positive(),
  }).parse(req.params);
  const result = await departmentService.removeDepartmentMember(req.user, params.id, params.userId, req.auditContext);
  res.json(result);
});

const listDepartmentMembers = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const list = await departmentService.listDepartmentMembers(req.user, params.id);
  res.json(list);
});

const getDepartmentAnalytics = asyncHandler(async (req, res) => {
  const analytics = await departmentService.getDepartmentAnalytics(req.user);
  res.json(analytics);
});

module.exports = {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  addDepartmentMember,
  removeDepartmentMember,
  listDepartmentMembers,
  getDepartmentAnalytics,
};
