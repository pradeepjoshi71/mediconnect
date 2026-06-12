const db = require("../config/db");

async function findItemById(id, hospitalId) {
  const result = await db.query(
    `
      SELECT 
        id,
        hospital_id AS "hospitalId",
        item_name AS "itemName",
        sku,
        category,
        unit,
        current_stock AS "currentStock",
        minimum_stock AS "minimumStock",
        expiry_date AS "expiryDate",
        vendor,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM inventory_items
      WHERE id = $1 AND hospital_id = $2
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function listItems(hospitalId, { category, search, lowStock }) {
  const params = [hospitalId];
  const where = ["hospital_id = $1"];

  if (category) {
    params.push(category);
    where.push(`category = $${params.length}`);
  }

  if (search) {
    params.push(`%${search}%`);
    where.push(`(item_name ILIKE $${params.length} OR sku ILIKE $${params.length} OR vendor ILIKE $${params.length})`);
  }

  if (lowStock === "true" || lowStock === true) {
    where.push("current_stock <= minimum_stock");
  }

  const result = await db.query(
    `
      SELECT 
        id,
        hospital_id AS "hospitalId",
        item_name AS "itemName",
        sku,
        category,
        unit,
        current_stock AS "currentStock",
        minimum_stock AS "minimumStock",
        expiry_date AS "expiryDate",
        vendor,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM inventory_items
      WHERE ${where.join(" AND ")}
      ORDER BY item_name ASC
    `,
    params
  );
  return result.rows;
}

async function createItem({ hospitalId, itemName, sku, category, unit, currentStock, minimumStock, expiryDate, vendor }) {
  const result = await db.query(
    `
      INSERT INTO inventory_items (
        hospital_id, item_name, sku, category, unit, 
        current_stock, minimum_stock, expiry_date, vendor
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      hospitalId,
      itemName,
      sku,
      category,
      unit,
      currentStock || 0,
      minimumStock || 0,
      expiryDate || null,
      vendor || null
    ]
  );
  return findItemById(result.rows[0].id, hospitalId);
}

async function updateItem(id, hospitalId, data) {
  const result = await db.query(
    `
      UPDATE inventory_items
      SET
        item_name = COALESCE($3, item_name),
        sku = COALESCE($4, sku),
        category = COALESCE($5, category),
        unit = COALESCE($6, unit),
        current_stock = COALESCE($7, current_stock),
        minimum_stock = COALESCE($8, minimum_stock),
        expiry_date = COALESCE($9, expiry_date),
        vendor = COALESCE($10, vendor),
        updated_at = now()
      WHERE id = $1 AND hospital_id = $2
      RETURNING id
    `,
    [
      id,
      hospitalId,
      data.itemName || null,
      data.sku || null,
      data.category || null,
      data.unit || null,
      data.currentStock !== undefined ? Number(data.currentStock) : null,
      data.minimumStock !== undefined ? Number(data.minimumStock) : null,
      data.expiryDate !== undefined ? data.expiryDate : null,
      data.vendor !== undefined ? data.vendor : null
    ]
  );
  return result.rows[0] ? findItemById(result.rows[0].id, hospitalId) : null;
}

async function deleteItem(id, hospitalId) {
  const result = await db.query(
    `
      DELETE FROM inventory_items
      WHERE id = $1 AND hospital_id = $2
      RETURNING id
    `,
    [id, hospitalId]
  );
  return result.rowCount > 0;
}

async function createTransaction({ hospitalId, inventoryItemId, transactionType, quantity, notes, createdBy }) {
  return db.withTransaction(async (client) => {
    // 1. Fetch item with lock to ensure stock consistency
    const itemRes = await client.query(
      `SELECT current_stock FROM inventory_items WHERE id = $1 AND hospital_id = $2 FOR UPDATE`,
      [inventoryItemId, hospitalId]
    );
    if (itemRes.rows.length === 0) {
      throw new Error("Inventory item not found");
    }
    const currentStock = itemRes.rows[0].current_stock;
    let newStock = currentStock;

    if (transactionType === 'Stock In') {
      newStock += quantity;
    } else if (transactionType === 'Stock Out' || transactionType === 'Transfer') {
      newStock -= quantity;
    } else if (transactionType === 'Adjustment') {
      newStock = quantity;
    }

    if (newStock < 0) {
      throw new Error("Transaction would result in negative stock level");
    }

    // 2. Update stock level
    await client.query(
      `UPDATE inventory_items SET current_stock = $1, updated_at = now() WHERE id = $2`,
      [newStock, inventoryItemId]
    );

    // 3. Log transaction
    const txRes = await client.query(
      `
        INSERT INTO inventory_transactions (
          hospital_id, inventory_item_id, transaction_type, quantity, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING 
          id, 
          hospital_id AS "hospitalId", 
          inventory_item_id AS "inventoryItemId", 
          transaction_type AS "transactionType", 
          quantity, 
          notes, 
          created_by AS "createdBy", 
          created_at AS "createdAt"
      `,
      [hospitalId, inventoryItemId, transactionType, quantity, notes, createdBy]
    );

    return txRes.rows[0];
  });
}

async function getInventoryReports(hospitalId) {
  // 1. Stock Summary
  const stockSummaryRes = await db.query(
    `
      SELECT 
        id,
        item_name AS "itemName",
        sku,
        category,
        unit,
        current_stock AS "currentStock",
        minimum_stock AS "minimumStock",
        expiry_date AS "expiryDate",
        vendor
      FROM inventory_items
      WHERE hospital_id = $1
      ORDER BY item_name ASC
    `,
    [hospitalId]
  );

  // 2. Low Stock Report
  const lowStockRes = await db.query(
    `
      SELECT 
        id,
        item_name AS "itemName",
        sku,
        category,
        unit,
        current_stock AS "currentStock",
        minimum_stock AS "minimumStock",
        vendor
      FROM inventory_items
      WHERE hospital_id = $1 AND current_stock <= minimum_stock
      ORDER BY current_stock ASC
    `,
    [hospitalId]
  );

  // 3. Expiring Inventory Report (30-day and 60-day warning)
  const expiringRes = await db.query(
    `
      SELECT 
        id,
        item_name AS "itemName",
        sku,
        category,
        expiry_date AS "expiryDate",
        current_stock AS "currentStock",
        CASE 
          WHEN expiry_date <= CURRENT_DATE THEN 'expired'
          WHEN expiry_date <= CURRENT_DATE + interval '30 days' THEN '30_days_warning'
          ELSE '60_days_warning'
        END AS "status"
      FROM inventory_items
      WHERE hospital_id = $1 
        AND expiry_date IS NOT NULL 
        AND expiry_date <= CURRENT_DATE + interval '60 days'
      ORDER BY expiry_date ASC
    `,
    [hospitalId]
  );

  return {
    stockSummary: stockSummaryRes.rows,
    lowStock: lowStockRes.rows,
    expiringInventory: expiringRes.rows,
  };
}

module.exports = {
  findItemById,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  createTransaction,
  getInventoryReports,
};
