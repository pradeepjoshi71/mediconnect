const businessRepository = require("../repositories/businessRepository");
const { recordAuditEvent } = require("./auditService");
const { AppError } = require("../utils/http");

async function getRevenueDashboard(user) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return businessRepository.getRevenueDashboardMetrics(user.hospitalId);
}

async function listExpenses(user, filters) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return businessRepository.listExpenses(user.hospitalId, filters);
}

async function getExpense(user, id) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  const expense = await businessRepository.findExpenseById(id, user.hospitalId);
  if (!expense) {
    throw new AppError(404, "Expense not found");
  }
  return expense;
}

async function createExpense(user, data, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  if (!data.category || !data.amount) {
    throw new AppError(400, "Category and amount are required");
  }

  const expense = await businessRepository.createExpense({
    hospitalId: user.hospitalId,
    category: data.category,
    amount: data.amount,
    description: data.description,
    expenseDate: data.expenseDate,
    createdBy: user.id,
  });

  await recordAuditEvent({
    user,
    action: "business.expense.created",
    entityType: "expenses",
    entityId: expense.id.toString(),
    newValue: expense,
    context,
  });

  return expense;
}

async function updateExpense(user, id, data, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldExpense = await businessRepository.findExpenseById(id, user.hospitalId);
  if (!oldExpense) {
    throw new AppError(404, "Expense not found");
  }

  const expense = await businessRepository.updateExpense(id, user.hospitalId, {
    category: data.category,
    amount: data.amount,
    description: data.description,
    expenseDate: data.expenseDate,
  });

  await recordAuditEvent({
    user,
    action: "business.expense.updated",
    entityType: "expenses",
    entityId: id.toString(),
    oldValue: oldExpense,
    newValue: expense,
    context,
  });

  return expense;
}

async function deleteExpense(user, id, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldExpense = await businessRepository.findExpenseById(id, user.hospitalId);
  if (!oldExpense) {
    throw new AppError(404, "Expense not found");
  }

  const deleted = await businessRepository.deleteExpense(id, user.hospitalId);
  if (!deleted) {
    throw new AppError(400, "Failed to delete expense");
  }

  await recordAuditEvent({
    user,
    action: "business.expense.deleted",
    entityType: "expenses",
    entityId: id.toString(),
    oldValue: oldExpense,
    context,
  });

  return { success: true };
}

async function getProfitLoss(user) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return businessRepository.getProfitLossSummary(user.hospitalId);
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
