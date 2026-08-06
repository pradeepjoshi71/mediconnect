const db = require("../config/db");

async function getHeadlineStats(hospitalId) {
  const result = await db.query(
    `
      SELECT
        (SELECT COUNT(*) FROM patients WHERE hospital_id = $1)::int AS "totalPatients",
        (SELECT COUNT(*) FROM doctors WHERE hospital_id = $1)::int AS "totalDoctors",
        (
          SELECT COUNT(*)
          FROM appointments
          WHERE hospital_id = $1
            AND scheduled_start >= date_trunc('day', now())
            AND scheduled_start < date_trunc('day', now()) + interval '1 day'
        )::int AS "appointmentsToday",
        (
          SELECT COUNT(*)
          FROM appointment_waitlist
          WHERE hospital_id = $1
            AND status = 'waiting'
        )::int AS "openWaitlist",
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE hospital_id = $1
            AND status = 'paid'
        )::numeric AS "revenueCollectedCents",
        (
          SELECT COALESCE(SUM(amount), 0)
          FROM payments
          WHERE hospital_id = $1
            AND status IN ('pending', 'processing')
        )::numeric AS "outstandingRevenueCents"
    `,
    [hospitalId]
  );
  return result.rows[0];
}

async function getAppointmentSeries(hospitalId) {
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
        WHERE a.hospital_id = $1
          AND a.scheduled_start >= buckets.day_bucket
          AND a.scheduled_start < buckets.day_bucket + interval '1 day'
      ) counts ON true
      ORDER BY day_bucket ASC
    `,
    [hospitalId]
  );
  return result.rows;
}

async function getRevenueSeries(hospitalId) {
  const result = await db.query(
    `
      SELECT
        to_char(day_bucket, 'Mon DD') AS label,
        day_bucket::date AS date,
        COALESCE(sums.revenue_cents, 0)::numeric AS "amountCents"
      FROM (
        SELECT
          generate_series(
            date_trunc('day', now()) - interval '6 days',
            date_trunc('day', now()),
            interval '1 day'
          ) AS day_bucket
      ) buckets
      LEFT JOIN LATERAL (
        SELECT SUM(p.amount) AS revenue_cents
        FROM payments p
        WHERE p.hospital_id = $1
          AND p.status = 'paid'
          AND p.paid_at >= buckets.day_bucket
          AND p.paid_at < buckets.day_bucket + interval '1 day'
      ) sums ON true
      ORDER BY day_bucket ASC
    `,
    [hospitalId]
  );
  return result.rows;
}

async function getDoctorPerformance(hospitalId) {
  const result = await db.query(
    `
      SELECT
        d.id AS "doctorId",
        u.full_name AS "doctorName",
        d.specialization,
        d.rating,
        COUNT(DISTINCT a.id)::int AS "completedAppointments",
        COALESCE(SUM(pay.amount), 0)::numeric AS "revenueCents"
      FROM doctors d
      JOIN users u ON u.id = d.user_id
      LEFT JOIN appointments a
        ON a.doctor_id = d.id
       AND a.hospital_id = d.hospital_id
       AND a.status = 'completed'
      LEFT JOIN invoices inv
        ON inv.appointment_id = a.id
       AND inv.hospital_id = d.hospital_id
      LEFT JOIN payments pay
        ON pay.invoice_id = inv.id
       AND pay.hospital_id = d.hospital_id
       AND pay.status = 'paid'
      WHERE d.hospital_id = $1
      GROUP BY d.id, u.full_name, d.specialization, d.rating
      ORDER BY "completedAppointments" DESC, d.rating DESC
      LIMIT 10
    `,
    [hospitalId]
  );
  return result.rows;
}

async function getStatusBreakdown(hospitalId) {
  const result = await db.query(
    `
      SELECT
        status,
        COUNT(*)::int AS count
      FROM appointments
      WHERE hospital_id = $1
      GROUP BY status
      ORDER BY count DESC
    `,
    [hospitalId]
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
