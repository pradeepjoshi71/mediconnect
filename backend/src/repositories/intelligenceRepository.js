const db = require("../config/db");

async function listFollowUpCandidates({ hospitalId, patientId }) {
  const params = [hospitalId];
  const where = [`mr.hospital_id = $1`, `mr.follow_up_in_days IS NOT NULL`];

  if (patientId) {
    params.push(patientId);
    where.push(`mr.patient_id = $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT
        mr.id AS "medicalRecordId",
        mr.patient_id AS "patientId",
        mr.doctor_id AS "doctorId",
        mr.diagnosis,
        mr.follow_up_in_days AS "followUpInDays",
        mr.created_at AS "createdAt",
        (mr.created_at + make_interval(days => mr.follow_up_in_days)) AS "followUpDueAt",
        pu.full_name AS "patientName",
        du.full_name AS "doctorName",
        d.specialization,
        p.medical_record_number AS "medicalRecordNumber"
      FROM medical_records mr
      JOIN patients p ON p.id = mr.patient_id
      JOIN users pu ON pu.id = p.user_id
      JOIN doctors d ON d.id = mr.doctor_id
      JOIN users du ON du.id = d.user_id
      WHERE ${where.join(" AND ")}
      ORDER BY "followUpDueAt" ASC
      LIMIT 100
    `,
    params
  );
  return result.rows;
}

async function listUpcomingAppointmentsForRisk(hospitalId, withinDays = 7) {
  const result = await db.query(
    `
      WITH payment_rollup AS (
        SELECT
          pay.patient_id,
          COUNT(*) FILTER (WHERE pay.status IN ('pending', 'processing'))::int AS pending_payments
        FROM payments pay
        WHERE pay.hospital_id = $1
        GROUP BY pay.patient_id
      ),
      patient_history AS (
        SELECT
          a.patient_id,
          COUNT(*) FILTER (WHERE a.status = 'no_show')::int AS no_show_count,
          COUNT(*)::int AS total_visits
        FROM appointments a
        WHERE a.hospital_id = $1
        GROUP BY a.patient_id
      )
      SELECT
        a.id AS "appointmentId",
        a.patient_id AS "patientId",
        a.doctor_id AS "doctorId",
        a.priority,
        a.status,
        a.scheduled_start AS "scheduledStart",
        pu.full_name AS "patientName",
        du.full_name AS "doctorName",
        d.specialization,
        COALESCE(ph.no_show_count, 0) AS "noShowCount",
        COALESCE(ph.total_visits, 0) AS "totalVisits",
        COALESCE(pr.pending_payments, 0) AS "pendingPayments"
      FROM appointments a
      JOIN patients p ON p.id = a.patient_id
      JOIN users pu ON pu.id = p.user_id
      JOIN doctors d ON d.id = a.doctor_id
      JOIN users du ON du.id = d.user_id
      LEFT JOIN patient_history ph ON ph.patient_id = a.patient_id
      LEFT JOIN payment_rollup pr ON pr.patient_id = a.patient_id
      WHERE a.hospital_id = $1
        AND a.scheduled_start >= now()
        AND a.scheduled_start < now() + make_interval(days => $2)
        AND a.status IN ('scheduled', 'confirmed')
      ORDER BY a.scheduled_start ASC
      LIMIT 100
    `,
    [hospitalId, withinDays]
  );
  return result.rows;
}

module.exports = {
  listFollowUpCandidates,
  listUpcomingAppointmentsForRisk,
};
