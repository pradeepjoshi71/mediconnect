const { z } = require("zod");
const medicineService = require("../services/medicineService");
const { asyncHandler } = require("../middlewares/asyncHandler");

const createMedicineSchema = z.object({
  medicineCode: z.string().trim().min(1).max(50),
  medicineName: z.string().trim().min(1).max(255),
  genericName: z.string().trim().max(255).optional().nullable(),
  manufacturer: z.string().trim().max(255).optional().nullable(),
  batchNumber: z.string().trim().max(50).optional().nullable(),
  expiryDate: z.string().trim().min(1),
  unitPrice: z.coerce.number().nonnegative(),
  stockQuantity: z.coerce.number().int().nonnegative().default(0),
  reorderLevel: z.coerce.number().int().nonnegative().default(0),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE")
});

const updateMedicineSchema = z.object({
  medicineCode: z.string().trim().min(1).max(50).optional(),
  medicineName: z.string().trim().min(1).max(255).optional(),
  genericName: z.string().trim().max(255).optional().nullable(),
  manufacturer: z.string().trim().max(255).optional().nullable(),
  batchNumber: z.string().trim().max(50).optional().nullable(),
  expiryDate: z.string().trim().min(1).optional(),
  unitPrice: z.coerce.number().nonnegative().optional(),
  stockQuantity: z.coerce.number().int().nonnegative().optional(),
  reorderLevel: z.coerce.number().int().nonnegative().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional()
});

const updateStockSchema = z.object({
  stockQuantity: z.coerce.number().int().nonnegative()
});

const listMedicines = asyncHandler(async (req, res) => {
  const filters = {
    status: req.query.status,
    alert: req.query.alert,
    search: req.query.search
  };
  const list = await medicineService.listMedicines(req.user, filters);
  res.json(list);
});

const createMedicine = asyncHandler(async (req, res) => {
  const payload = createMedicineSchema.parse(req.body);
  const result = await medicineService.createMedicine(req.user, payload, req.auditContext);
  res.status(201).json(result);
});

const updateMedicine = asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateMedicineSchema.parse(req.body);
  const result = await medicineService.updateMedicine(req.user, id, payload, req.auditContext);
  res.json(result);
});

const updateStock = asyncHandler(async (req, res) => {
  const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
  const payload = updateStockSchema.parse(req.body);
  const result = await medicineService.updateStock(req.user, id, payload.stockQuantity, req.auditContext);
  res.json(result);
});

module.exports = {
  listMedicines,
  createMedicine,
  updateMedicine,
  updateStock
};
