const { z } = require("zod");
const businessService = require("../services/businessService");

const expenseCreateSchema = z.object({
  category: z.enum(['Rent', 'Electricity', 'Internet', 'Salary', 'Equipment', 'Miscellaneous']),
  amount: z.coerce.number().positive(),
  description: z.string().optional(),
  expenseDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
});

const expenseUpdateSchema = expenseCreateSchema.partial();

async function getRevenueDashboard(req, res, next) {
  try {
    const data = await businessService.getRevenueDashboard(req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function listExpenses(req, res, next) {
  try {
    const filters = {
      category: req.query.category,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    };
    const data = await businessService.listExpenses(req.user, filters);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const data = await businessService.getExpense(req.user, id);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createExpense(req, res, next) {
  try {
    const parsed = expenseCreateSchema.parse(req.body);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await businessService.createExpense(req.user, parsed, context);
    res.status(201).json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    next(error);
  }
}

async function updateExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const parsed = expenseUpdateSchema.parse(req.body);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await businessService.updateExpense(req.user, id, parsed, context);
    res.json(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input data", errors: error.errors });
    }
    next(error);
  }
}

async function deleteExpense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const context = {
      requestId: req.requestId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    };
    const data = await businessService.deleteExpense(req.user, id, context);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function getProfitLoss(req, res, next) {
  try {
    const data = await businessService.getProfitLoss(req.user);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getRevenueDashboard,
  listExpenses,
  getExpense,
  createExpense,
  updateExpense,
  deleteExpense,
  getProfitLoss,
};
