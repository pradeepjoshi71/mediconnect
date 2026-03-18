const db = require("../config/db");

const PAYMENT_SELECT = `
  SELECT
    pay.id,
    pay.appointment_id AS "appointmentId",
    pay.patient_id AS "patientId",
    pay.initiated_by_user_id AS "initiatedByUserId",
    pay.provider,
    pay.amount_cents AS "amountCents",
    pay.currency,
    pay.status,
    pay.invoice_number AS "invoiceNumber",
    pay.external_reference AS "externalReference",
    pay.payment_method_label AS "paymentMethodLabel",
    pay.paid_at AS "paidAt",
    pay.metadata,
    pay.created_at AS "createdAt",
    pay.updated_at AS "updatedAt",
    pu.full_name AS "patientName",
    a.doctor_id AS "doctorId",
    du.full_name AS "doctorName"
  FROM payments pay
  JOIN patients p ON p.id = pay.patient_id
  JOIN users pu ON pu.id = p.user_id
  LEFT JOIN appointments a ON a.id = pay.appointment_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  LEFT JOIN users du ON du.id = d.user_id
`;

async function listPayments({ role, patientId }) {
  const params = [];
  const where = [];
  if (role === "patient") {
    params.push(patientId);
    where.push(`pay.patient_id = $${params.length}`);
  }

  const result = await db.query(
    `
      ${PAYMENT_SELECT}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY pay.created_at DESC
      LIMIT 200
    `,
    params
  );
  return result.rows;
}

async function findPaymentById(id) {
  const result = await db.query(
    `
      ${PAYMENT_SELECT}
      WHERE pay.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function createPayment({
  appointmentId,
  patientId,
  initiatedByUserId,
  provider,
  amountCents,
  currency,
  invoiceNumber,
  paymentMethodLabel,
  metadata,
}) {
  const result = await db.query(
    `
      INSERT INTO payments (
        appointment_id,
        patient_id,
        initiated_by_user_id,
        provider,
        amount_cents,
        currency,
        invoice_number,
        payment_method_label,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `,
    [
      appointmentId || null,
      patientId,
      initiatedByUserId || null,
      provider,
      amountCents,
      currency,
      invoiceNumber,
      paymentMethodLabel || null,
      metadata || {},
    ]
  );
  return findPaymentById(result.rows[0].id);
}

async function updatePayment(id, patch) {
  const result = await db.query(
    `
      UPDATE payments
      SET
        status = COALESCE($2, status),
        external_reference = COALESCE($3, external_reference),
        payment_method_label = COALESCE($4, payment_method_label),
        paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END
      WHERE id = $1
      RETURNING id
    `,
    [id, patch.status || null, patch.externalReference || null, patch.paymentMethodLabel || null]
  );
  return result.rows[0] ? findPaymentById(result.rows[0].id) : null;
}

module.exports = {
  listPayments,
  findPaymentById,
  createPayment,
  updatePayment,
};
