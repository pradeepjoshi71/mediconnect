const pool = require("../config/db");
const { z } = require("zod");

function providerCheckoutUrl(provider, paymentId) {
  if (provider === "stripe") return `https://checkout.stripe.com/pay/mock_${paymentId}`;
  return `https://razorpay.com/payment/mock_${paymentId}`;
}

async function createCheckout(req, res) {
  try {
    const user = req.user;
    const schema = z.object({
      appointmentId: z.number().int().positive(),
      provider: z.enum(["stripe", "razorpay"]),
      amountCents: z.number().int().positive().optional(),
      currency: z.string().min(3).max(8).optional(),
    });
    const { appointmentId, provider, amountCents, currency } = schema.parse(req.body);

    const appt = await pool.query(
      `SELECT id, patient_id, status FROM appointments WHERE id = $1`,
      [appointmentId]
    );
    const row = appt.rows[0];
    if (!row) return res.status(404).json({ message: "Appointment not found" });
    if (user.role !== "admin" && row.patient_id !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const result = await pool.query(
      `INSERT INTO payments (appointment_id, patient_id, provider, amount_cents, currency, status)
       VALUES ($1,$2,$3,$4,$5,'created')
       RETURNING *`,
      [
        appointmentId,
        row.patient_id,
        provider,
        amountCents || 2500,
        currency || "USD",
      ]
    );
    const payment = result.rows[0];
    res.status(201).json({
      payment,
      checkoutUrl: providerCheckoutUrl(provider, payment.id),
      note: "Placeholder checkout URL (no real payment processed).",
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: e.issues });
    }
    console.error("payments create checkout:", e.message);
    res.status(500).json({ message: "Failed to create checkout" });
  }
}

async function listMyPayments(req, res) {
  try {
    const user = req.user;
    const result =
      user.role === "admin"
        ? await pool.query(`SELECT * FROM payments ORDER BY created_at DESC LIMIT 50`)
        : await pool.query(
            `SELECT * FROM payments WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
            [user.id]
          );
    res.json(result.rows);
  } catch (e) {
    console.error("payments list:", e.message);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
}

async function markPaid(req, res) {
  try {
    const id = Number(req.params.id);
    const user = req.user;

    const paymentRes = await pool.query(`SELECT * FROM payments WHERE id = $1`, [id]);
    const payment = paymentRes.rows[0];
    if (!payment) return res.status(404).json({ message: "Not found" });
    if (user.role !== "admin" && payment.patient_id !== user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updated = await pool.query(
      `UPDATE payments
       SET status = 'paid', updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    res.json(updated.rows[0]);
  } catch (e) {
    console.error("payments mark paid:", e.message);
    res.status(500).json({ message: "Failed to update payment" });
  }
}

module.exports = { createCheckout, listMyPayments, markPaid };

