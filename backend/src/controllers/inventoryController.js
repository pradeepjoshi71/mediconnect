const { z } = require("zod");
const inventoryService = require("../services/inventoryService");

const itemCreateSchema = z.object({
  itemName: z.string().min(1, "Item Name is required"),
  sku: z.string().min(1, "SKU is required"),
  category: z.string().min(1, "Category is required"),
  unit: z.string().min(1, "Unit is required"),
  currentStock: z.coerce.number().int().nonnegative().default(0),
  minimumStock: z.coerce.number().int().nonnegative().default(0),
  expiryDate: z.string().date().or(z.string().datetime()).nullable().optional(),
  vendor: z.string().nullable().optional(),
});

const itemUpdateSchema = itemCreateSchema.partial();

const transactionCreateSchema = z.object({
  inventoryItemId: z.coerce.number().int().positive(),
  transactionType: z.enum(['Stock In', 'Stock Out', 'Adjustment', 'Transfer']),
  quantity: z.coerce.number().int().positive(),
  notes: z.string().nullable().optional(),
});

async function listItems(req, res, next) {
  try {
    const filters = {
      category: req.query.category,
      search: req.query.search,
      lowStock: req.query.lowStock,
    };
    const data = await inventoryService.listItems(req.user, filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = await inventoryService.getItem(req.user, id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createItem(req, res, next) {
  try {
    const parsed = itemCreateSchema.parse(req.body);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await inventoryService.createItem(req.user, parsed, context);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    next(error);
  }
}

async function updateItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const parsed = itemUpdateSchema.parse(req.body);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await inventoryService.updateItem(req.user, id, parsed, context);
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    next(error);
  }
}

async function deleteItem(req, res, next) {
  try {
    const id = Number(req.params.id);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await inventoryService.deleteItem(req.user, id, context);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createTransaction(req, res, next) {
  try {
    const parsed = transactionCreateSchema.parse(req.body);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await inventoryService.createTransaction(req.user, parsed, context);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    next(error);
  }
}

async function getReports(req, res, next) {
  try {
    const data = await inventoryService.getReports(req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  createTransaction,
  getReports,
};
