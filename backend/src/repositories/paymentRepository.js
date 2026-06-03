const db = require("../config/db");

const PAYMENT_SELECT = `
  SELECT
    pay.id,
    pay.hospital_id AS "hospitalId",
    pay.invoice_id AS "invoiceId",
    pay.patient_id AS "patientId",
    pay.payment_method AS "paymentMethodLabel",
    pay.payment_method AS "paymentMethod",
    pay.payment_provider AS "provider",
    pay.transaction_id AS "transactionId",
    pay.amount,
    (pay.amount * 100)::integer AS "amountCents",
    pay.status,
    pay.paid_at AS "paidAt",
    pay.razorpay_order_id AS "razorpayOrderId",
    pay.razorpay_payment_id AS "razorpayPaymentId",
    pay.razorpay_signature AS "razorpaySignature",
    pay.created_at AS "createdAt",
    pay.updated_at AS "updatedAt",
    inv.invoice_number AS "invoiceNumber",
    inv.appointment_id AS "appointmentId",
    pu.full_name AS "patientName",
    p.medical_record_number AS "patientMRN",
    a.doctor_id AS "doctorId",
    du.full_name AS "doctorName"
  FROM payments pay
  JOIN invoices inv ON inv.id = pay.invoice_id
  JOIN patients p ON p.id = pay.patient_id
  JOIN users pu ON pu.id = p.user_id
  LEFT JOIN appointments a ON a.id = inv.appointment_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  LEFT JOIN users du ON du.id = d.user_id
`;

async function listPayments({ hospitalId, role, patientId }) {
  const params = [hospitalId];
  const where = ["pay.hospital_id = $1"];

  if (role === "patient" && patientId) {
    params.push(patientId);
    where.push(`pay.patient_id = $${params.length}`);
  } else if (patientId) {
    params.push(patientId);
    where.push(`pay.patient_id = $${params.length}`);
  }

  const result = await db.query(
    `
      ${PAYMENT_SELECT}
      WHERE ${where.join(" AND ")}
      ORDER BY pay.created_at DESC
      LIMIT 200
    `,
    params
  );
  return result.rows;
}

async function findPaymentById(id, hospitalId) {
  const result = await db.query(
    `
      ${PAYMENT_SELECT}
      WHERE pay.id = $1 AND pay.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function findPaymentByOrderId(orderId, hospitalId) {
  const result = await db.query(
    `
      ${PAYMENT_SELECT}
      WHERE pay.razorpay_order_id = $1 AND pay.hospital_id = $2
      LIMIT 1
    `,
    [orderId, hospitalId]
  );
  return result.rows[0] || null;
}

async function createPayment({
  hospitalId,
  invoiceId,
  patientId,
  paymentMethod,
  paymentProvider,
  transactionId,
  amount,
  status,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
}) {
  const result = await db.query(
    `
      INSERT INTO payments (
        hospital_id,
        invoice_id,
        patient_id,
        payment_method,
        payment_provider,
        transaction_id,
        amount,
        status,
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paid_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CASE WHEN $8 = 'paid' THEN now() ELSE null END)
      RETURNING id
    `,
    [
      hospitalId,
      invoiceId,
      patientId,
      paymentMethod,
      paymentProvider || "Razorpay",
      transactionId || null,
      amount,
      status || "pending",
      razorpayOrderId || null,
      razorpayPaymentId || null,
      razorpaySignature || null
    ]
  );
  return findPaymentById(result.rows[0].id, hospitalId);
}

async function updatePayment(id, hospitalId, patch) {
  const result = await db.query(
    `
      UPDATE payments
      SET
        status = COALESCE($2, status),
        transaction_id = COALESCE($3, transaction_id),
        razorpay_payment_id = COALESCE($4, razorpay_payment_id),
        razorpay_signature = COALESCE($5, razorpay_signature),
        paid_at = CASE WHEN $2 = 'paid' THEN now() ELSE paid_at END,
        updated_at = now()
      WHERE id = $1 AND hospital_id = $6
      RETURNING id
    `,
    [
      id,
      patch.status || null,
      patch.transactionId || null,
      patch.razorpayPaymentId || null,
      patch.razorpaySignature || null,
      hospitalId
    ]
  );
  return result.rows[0] ? findPaymentById(result.rows[0].id, hospitalId) : null;
}

module.exports = {
  listPayments,
  findPaymentById,
  findPaymentByOrderId,
  createPayment,
  updatePayment,
};
