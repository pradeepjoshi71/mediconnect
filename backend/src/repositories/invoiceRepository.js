const db = require("../config/db");

const INVOICE_SELECT = `
  SELECT
    inv.id,
    inv.hospital_id AS "hospitalId",
    inv.invoice_number AS "invoiceNumber",
    inv.patient_id AS "patientId",
    inv.appointment_id AS "appointmentId",
    inv.created_by AS "createdBy",
    inv.subtotal,
    inv.tax_amount AS "taxAmount",
    inv.discount_amount AS "discountAmount",
    inv.total_amount AS "totalAmount",
    inv.status,
    inv.created_at AS "createdAt",
    inv.updated_at AS "updatedAt",
    pu.full_name AS "patientName",
    p.medical_record_number AS "patientMRN",
    pu.email AS "patientEmail",
    pu.phone AS "patientPhone",
    cu.full_name AS "creatorName",
    a.doctor_id AS "doctorId",
    du.full_name AS "doctorName"
  FROM invoices inv
  JOIN patients p ON p.id = inv.patient_id
  JOIN users pu ON pu.id = p.user_id
  LEFT JOIN users cu ON cu.id = inv.created_by
  LEFT JOIN appointments a ON a.id = inv.appointment_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  LEFT JOIN users du ON du.id = d.user_id
`;

async function findInvoiceById(id, hospitalId) {
  const invoiceResult = await db.query(
    `
      ${INVOICE_SELECT}
      WHERE inv.id = $1 AND inv.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );

  const invoice = invoiceResult.rows[0];
  if (!invoice) return null;

  const itemsResult = await db.query(
    `
      SELECT
        id,
        invoice_id AS "invoiceId",
        item_type AS "itemType",
        item_name AS "itemName",
        quantity,
        unit_price AS "unitPrice",
        total_price AS "totalPrice"
      FROM invoice_items
      WHERE invoice_id = $1
      ORDER BY id ASC
    `,
    [id]
  );

  invoice.items = itemsResult.rows;
  return invoice;
}

async function listInvoices({ hospitalId, patientId, status }) {
  const params = [hospitalId];
  const where = ["inv.hospital_id = $1"];

  if (patientId) {
    params.push(patientId);
    where.push(`inv.patient_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    where.push(`inv.status = $${params.length}`);
  }

  const result = await db.query(
    `
      ${INVOICE_SELECT}
      WHERE ${where.join(" AND ")}
      ORDER BY inv.created_at DESC
      LIMIT 100
    `,
    params
  );

  return result.rows;
}

async function createInvoice(hospitalId, data) {
  return db.withTransaction(async (client) => {
    const result = await client.query(
      `
        INSERT INTO invoices (
          hospital_id,
          invoice_number,
          patient_id,
          appointment_id,
          created_by,
          subtotal,
          tax_amount,
          discount_amount,
          total_amount,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        hospitalId,
        data.invoiceNumber,
        data.patientId,
        data.appointmentId || null,
        data.createdBy,
        data.subtotal || 0,
        data.taxAmount || 0,
        data.discountAmount || 0,
        data.totalAmount || 0,
        data.status || "draft"
      ]
    );

    const invoiceId = result.rows[0].id;

    if (data.items && Array.isArray(data.items)) {
      for (const item of data.items) {
        await client.query(
          `
            INSERT INTO invoice_items (
              invoice_id,
              item_type,
              item_name,
              quantity,
              unit_price,
              total_price
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            invoiceId,
            item.itemType,
            item.itemName,
            item.quantity,
            item.unitPrice,
            item.totalPrice
          ]
        );
      }
    }

    return invoiceId;
  });
}

async function updateInvoice(id, hospitalId, data) {
  return db.withTransaction(async (client) => {
    // Check if invoice exists
    const check = await client.query(
      `SELECT id FROM invoices WHERE id = $1 AND hospital_id = $2`,
      [id, hospitalId]
    );
    if (check.rows.length === 0) return null;

    await client.query(
      `
        UPDATE invoices
        SET
          patient_id = COALESCE($3, patient_id),
          appointment_id = COALESCE($4, appointment_id),
          subtotal = COALESCE($5, subtotal),
          tax_amount = COALESCE($6, tax_amount),
          discount_amount = COALESCE($7, discount_amount),
          total_amount = COALESCE($8, total_amount),
          status = COALESCE($9, status),
          updated_at = now()
        WHERE id = $1 AND hospital_id = $2
      `,
      [
        id,
        hospitalId,
        data.patientId || null,
        data.appointmentId || null,
        data.subtotal,
        data.taxAmount,
        data.discountAmount,
        data.totalAmount,
        data.status
      ]
    );

    if (data.items && Array.isArray(data.items)) {
      // Recreate invoice items
      await client.query(`DELETE FROM invoice_items WHERE invoice_id = $1`, [id]);
      for (const item of data.items) {
        await client.query(
          `
            INSERT INTO invoice_items (
              invoice_id,
              item_type,
              item_name,
              quantity,
              unit_price,
              total_price
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            id,
            item.itemType,
            item.itemName,
            item.quantity,
            item.unitPrice,
            item.totalPrice
          ]
        );
      }
    }

    return id;
  });
}

async function updateInvoiceStatus(id, hospitalId, status) {
  const result = await db.query(
    `
      UPDATE invoices
      SET status = $1, updated_at = now()
      WHERE id = $2 AND hospital_id = $3
      RETURNING id
    `,
    [status, id, hospitalId]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function getRevenueMetrics(hospitalId) {
  // 1. Revenue Today
  const todayResult = await db.query(
    `
      SELECT COALESCE(SUM(amount), 0.00) AS total
      FROM payments
      WHERE hospital_id = $1
        AND status = 'paid'
        AND paid_at >= date_trunc('day', now())
    `,
    [hospitalId]
  );

  // 2. Revenue This Month
  const monthResult = await db.query(
    `
      SELECT COALESCE(SUM(amount), 0.00) AS total
      FROM payments
      WHERE hospital_id = $1
        AND status = 'paid'
        AND paid_at >= date_trunc('month', now())
    `,
    [hospitalId]
  );

  // 3. Outstanding Invoices
  const outstandingResult = await db.query(
    `
      SELECT COALESCE(SUM(total_amount), 0.00) AS total
      FROM invoices
      WHERE hospital_id = $1
        AND status = 'pending'
    `,
    [hospitalId]
  );

  // 4. Successful Payments count
  const successResult = await db.query(
    `
      SELECT COUNT(*)::integer AS count
      FROM payments
      WHERE hospital_id = $1
        AND status = 'paid'
    `,
    [hospitalId]
  );

  // 5. Failed Payments count
  const failedResult = await db.query(
    `
      SELECT COUNT(*)::integer AS count
      FROM payments
      WHERE hospital_id = $1
        AND status = 'failed'
    `,
    [hospitalId]
  );

  return {
    revenueToday: Number(todayResult.rows[0].total),
    revenueThisMonth: Number(monthResult.rows[0].total),
    outstandingInvoices: Number(outstandingResult.rows[0].total),
    successfulPayments: successResult.rows[0].count,
    failedPayments: failedResult.rows[0].count
  };
}

module.exports = {
  findInvoiceById,
  listInvoices,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  getRevenueMetrics
};
