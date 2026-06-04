const { z } = require("zod");
const labService = require("../services/labService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createLabTestSchema = z.object({
  testCode: z.string().trim().min(1).max(50),
  testName: z.string().trim().min(1).max(255),
  category: z.string().trim().min(1).max(100),
  price: z.number().nonnegative(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active")
});

const listLabOrdersSchema = z.object({
  patientId: z.coerce.number().int().positive().optional(),
  doctorId: z.coerce.number().int().positive().optional(),
  status: z.enum(["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "COMPLETED", "CANCELLED"]).optional()
});

const createLabOrderSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive().optional(),
  testId: z.number().int().positive()
});

const updateOrderStatusSchema = z.object({
  status: z.enum(["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "COMPLETED", "CANCELLED"])
});

const createLabReportSchema = z.object({
  labOrderId: z.number().int().positive(),
  reportFileUrl: z.string().trim().min(1),
  reportNotes: z.string().optional().nullable()
});

const listLabTests = asyncHandler(async (req, res) => {
  const tests = await labService.listLabTests(req.user);
  res.json(tests);
});

const createLabTest = asyncHandler(async (req, res) => {
  const payload = createLabTestSchema.parse(req.body);
  const test = await labService.createLabTest(req.user, payload, req.auditContext);
  res.status(201).json(test);
});

const listLabOrders = asyncHandler(async (req, res) => {
  const query = listLabOrdersSchema.parse(req.query);
  const orders = await labService.listLabOrders(req.user, query, req.auditContext);
  res.json(orders);
});

const createLabOrder = asyncHandler(async (req, res) => {
  const payload = createLabOrderSchema.parse(req.body);
  const order = await labService.createLabOrder(req.user, payload, req.auditContext);
  res.status(201).json(order);
});

const updateLabOrderStatus = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateOrderStatusSchema.parse(req.body);
  const order = await labService.updateLabOrderStatus(req.user, params.id, payload.status, req.auditContext);
  res.json(order);
});

const createLabReport = asyncHandler(async (req, res) => {
  const body = z.object({
    labOrderId: z.coerce.number().int().positive(),
    reportNotes: z.string().optional().nullable()
  }).parse(req.body);

  if (!req.file) {
    return res.status(400).json({ message: "No report file provided" });
  }

  const payload = {
    labOrderId: body.labOrderId,
    reportFileUrl: req.file.path,
    reportNotes: body.reportNotes
  };

  const reportId = await labService.createLabReport(req.user, payload, req.auditContext);
  res.status(201).json({ id: reportId, success: true });
});

const listLabReports = asyncHandler(async (req, res) => {
  const params = z.object({ patientId: z.coerce.number().int().positive().optional() }).parse(req.params);
  const reports = await labService.listLabReports(req.user, params.patientId, req.auditContext);
  res.json(reports);
});

const getRevenueReports = asyncHandler(async (req, res) => {
  const reports = await labService.getRevenueByTestType(req.user, req.auditContext);
  res.json(reports);
});

const downloadLabReport = asyncHandler(async (req, res) => {
  const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const report = await labService.getLabReportFile(req.user, params.id);
  const path = require("path");
  const fileName = path.basename(report.report_file_url);
  res.download(report.report_file_url, fileName);
});

module.exports = {
  listLabTests,
  createLabTest,
  listLabOrders,
  createLabOrder,
  updateLabOrderStatus,
  createLabReport,
  listLabReports,
  getRevenueReports,
  downloadLabReport
};
