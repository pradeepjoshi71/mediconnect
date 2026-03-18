const db = require("../config/db");

async function getHeadlineStats() {
  const result = await db.query(
    `
      SELECT
        (SELECT COUNT(*) FROM patients)::int AS "totalPatients",
        (SELECT COUNT(*) FROM doctors)::int AS "totalDoctors",
        (
          SELECT COUNT(*)
          FROM appointments
          WHERE scheduled_start >= date_trunc('day', now())
            AND scheduled_start < date_trunc('day', now()) + interval '1 day'
        )::int AS "appointmentsToday",
        (
          SELECT COUNT(*)
          FROM appointment_waitlist
          WHERE status = 'waiting'
        )::int AS "openWaitlist",
        (
          SELECT COALESCE(SUM(amount_cents), 0)
          FROM payments
          WHERE status = 'paid'
        )::int AS "revenueCollectedCents",
        (
          SELECT COALESCE(SUM(amount_cents), 0)
          FROM payments
          WHERE status IN ('pending', 'processing')
        )::int AS "outstandingRevenueCents"
    `
  );
  return result.rows[0];
}

async function getAppointmentSeries() {
  const result = await db.query(
    `
      SELECT
        to_char(day_bucket, 'Mon DD') AS label,
        day_bucket::date AS date,
        appointment_count::int AS count
      FROM (
        SELECT
          generate_series(
            date_trunc('day', now()) - interval '6 days',
            date_trunc('day', now()),
            interval '1 day'
          ) AS day_bucket
      ) buckets
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS appointment_count
        FROM appointments a
        WHERE a.scheduled_start >= buckets.day_bucket
          AND a.scheduled_start < buckets.day_bucket + interval '1 day'
      ) counts ON true
      ORDER BY day_bucket ASC
    `
  );
  return result.rows;
}

async function getRevenueSeries() {
  const result = await db.query(
    `
      SELECT
        to_char(day_bucket, 'Mon DD') AS label,
        day_bucket::date AS date,
        COALESCE(amount_cents, 0)::int AS "amountCents"
      FROM (
        SELECT
          generate_series(
            date_trunc('day', now()) - interval '6 days',
            date_trunc('day', now()),
            interval '1 day'
          ) AS day_bucket
      ) buckets
      LEFT JOIN LATERAL (
        SELECT SUM(p.amount_cents) AS amount_cents
        FROM payments p
        WHERE p.status = 'paid'
          AND p.paid_at >= buckets.day_bucket
          AND p.paid_at < buckets.day_bucket + interval '1 day'
      ) sums ON true
      ORDER BY day_bucket ASC
    `
  );
  return result.rows;
}

async function getDoctorPerformance() {
  const result = await db.query(
    `
      SELECT
        d.id AS "doctorId",
        u.full_name AS "doctorName",
        d.specialization,
        d.rating,
        COUNT(a.id)::int AS "completedAppointments",
        COALESCE(SUM(pay.amount_cents), 0)::int AS "revenueCents"
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN appointments a
        ON a.doctor_id = d.id
       AND a.status = 'completed'
      LEFT JOIN payments pay
        ON pay.appointment_id = a.id
       AND pay.status = 'paid'
      GROUP BY d.id, u.full_name, d.specialization, d.rating
      ORDER BY "completedAppointments" DESC, d.rating DESC
      LIMIT 10
    `
  );
  return result.rows;
}

async function getStatusBreakdown() {
  const result = await db.query(
    `
      SELECT
        status,
        COUNT(*)::int AS count
      FROM appointments
      GROUP BY status
      ORDER BY count DESC
    `
  );
  return result.rows;
}

module.exports = {
  getHeadlineStats,
  getAppointmentSeries,
  getRevenueSeries,
  getDoctorPerformance,
  getStatusBreakdown,
};
