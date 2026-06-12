const inventoryRepository = require("../repositories/inventoryRepository");
const { recordAuditEvent } = require("./auditService");
const { AppError } = require("../utils/http");

async function getItem(user, id) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  const item = await inventoryRepository.findItemById(id, user.hospitalId);
  if (!item) {
    throw new AppError(404, "Inventory item not found");
  }
  return item;
}

async function listItems(user, filters) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return inventoryRepository.listItems(user.hospitalId, filters);
}

async function createItem(user, data, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  if (!data.itemName || !data.sku || !data.category || !data.unit) {
    throw new AppError(400, "Item Name, SKU, Category, and Unit are required");
  }

  const item = await inventoryRepository.createItem({
    hospitalId: user.hospitalId,
    itemName: data.itemName,
    sku: data.sku,
    category: data.category,
    unit: data.unit,
    currentStock: data.currentStock,
    minimumStock: data.minimumStock,
    expiryDate: data.expiryDate,
    vendor: data.vendor,
  });

  await recordAuditEvent({
    user,
    action: "inventory.item.created",
    entityType: "inventory_items",
    entityId: item.id.toString(),
    newValue: item,
    context,
  });

  return item;
}

async function updateItem(user, id, data, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldItem = await inventoryRepository.findItemById(id, user.hospitalId);
  if (!oldItem) {
    throw new AppError(404, "Inventory item not found");
  }

  const item = await inventoryRepository.updateItem(id, user.hospitalId, data);

  await recordAuditEvent({
    user,
    action: "inventory.item.updated",
    entityType: "inventory_items",
    entityId: id.toString(),
    oldValue: oldItem,
    newValue: item,
    context,
  });

  return item;
}

async function deleteItem(user, id, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }

  const oldItem = await inventoryRepository.findItemById(id, user.hospitalId);
  if (!oldItem) {
    throw new AppError(404, "Inventory item not found");
  }

  const deleted = await inventoryRepository.deleteItem(id, user.hospitalId);
  if (!deleted) {
    throw new AppError(400, "Failed to delete inventory item");
  }

  await recordAuditEvent({
    user,
    action: "inventory.item.deleted",
    entityType: "inventory_items",
    entityId: id.toString(),
    oldValue: oldItem,
    context,
  });

  return { success: true };
}

async function createTransaction(user, data, context) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  if (!data.inventoryItemId || !data.transactionType || !data.quantity) {
    throw new AppError(400, "Item, Transaction Type, and Quantity are required");
  }

  const tx = await inventoryRepository.createTransaction({
    hospitalId: user.hospitalId,
    inventoryItemId: data.inventoryItemId,
    transactionType: data.transactionType,
    quantity: data.quantity,
    notes: data.notes,
    createdBy: user.id,
  });

  // Fetch updated item to log in audit
  const updatedItem = await inventoryRepository.findItemById(data.inventoryItemId, user.hospitalId);

  await recordAuditEvent({
    user,
    action: "inventory.transaction.created",
    entityType: "inventory_transactions",
    entityId: tx.id.toString(),
    newValue: { transaction: tx, updatedItem },
    context,
  });

  return tx;
}

async function getReports(user) {
  if (!user.hospitalId) {
    throw new AppError(400, "Hospital context is required");
  }
  return inventoryRepository.getInventoryReports(user.hospitalId);
}

module.exports = {
  getItem,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  createTransaction,
  getReports,
};
