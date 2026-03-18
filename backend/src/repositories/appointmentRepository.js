const db = require("../config/db");

const APPOINTMENT_SELECT = `
  SELECT
    a.id,
    a.patient_id AS "patientId",
    a.doctor_id AS "doctorId",
    a.booked_by_user_id AS "bookedByUserId",
    a.scheduled_start AS "scheduledStart",
    a.scheduled_end AS "scheduledEnd",
    a.appointment_type AS "appointmentType",
    a.consultation_mode AS "consultationMode",
    a.reason,
    a.status,
    a.priority,
    a.queue_number AS "queueNumber",
    a.waiting_list_requested AS "waitingListRequested",
    a.waitlist_rank AS "waitlistRank",
    a.cancellation_reason AS "cancellationReason",
    a.completed_at AS "completedAt",
    a.created_at AS "createdAt",
    a.updated_at AS "updatedAt",
    pu.full_name AS "patientName",
    pu.email AS "patientEmail",
    pu.id AS "patientUserId",
    p.medical_record_number AS "medicalRecordNumber",
    du.full_name AS "doctorName",
    du.email AS "doctorEmail",
    du.id AS "doctorUserId",
    d.specialization,
    d.department,
    d.consultation_fee_cents AS "consultationFeeCents"
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users pu ON pu.id = p.user_id
  JOIN doctors d ON d.id = a.doctor_id
  JOIN users du ON du.id = d.user_id
`;

async function listAppointmentsForScope({ role, patientId, doctorId, date, status }) {
  const where = [];
  const params = [];

  if (role === "patient") {
    params.push(patientId);
    where.push(`a.patient_id = $${params.length}`);
  }
  if (role === "doctor") {
    params.push(doctorId);
    where.push(`a.doctor_id = $${params.length}`);
  }
  if (date) {
    params.push(`${date}T00:00:00.000Z`);
    params.push(`${date}T23:59:59.999Z`);
    where.push(`a.scheduled_start BETWEEN $${params.length - 1} AND $${params.length}`);
  }
  if (status) {
    params.push(status);
    where.push(`a.status = $${params.length}`);
  }

  const result = await db.query(
    `
      ${APPOINTMENT_SELECT}
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY a.scheduled_start DESC
      LIMIT 200
    `,
    params
  );
  return result.rows;
}

async function findAppointmentById(id) {
  const result = await db.query(
    `
      ${APPOINTMENT_SELECT}
      WHERE a.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function findActiveAppointmentConflict(doctorId, startsAt, excludeAppointmentId = null) {
  const params = [doctorId, startsAt];
  const excludeClause = excludeAppointmentId ? `AND a.id <> $3` : "";
  if (excludeAppointmentId) params.push(excludeAppointmentId);

  const result = await db.query(
    `
      SELECT a.id
      FROM appointments a
      WHERE a.doctor_id = $1
        AND a.scheduled_start = $2
        AND a.status IN ('scheduled', 'confirmed', 'checked_in', 'in_consultation')
        ${excludeClause}
      LIMIT 1
    `,
    params
  );
  return result.rows[0] || null;
}

async function listDoctorAppointmentsBetween(doctorId, startsAt, endsAt) {
  const result = await db.query(
    `
      ${APPOINTMENT_SELECT}
      WHERE a.doctor_id = $1
        AND a.scheduled_start >= $2
        AND a.scheduled_start <= $3
      ORDER BY a.scheduled_start ASC
    `,
    [doctorId, startsAt, endsAt]
  );
  return result.rows;
}

async function getNextQueueNumber(doctorId, startsAt, endsAt) {
  const result = await db.query(
    `
      SELECT COALESCE(MAX(queue_number), 0) + 1 AS "nextQueueNumber"
      FROM appointments
      WHERE doctor_id = $1
        AND scheduled_start BETWEEN $2 AND $3
    `,
    [doctorId, startsAt, endsAt]
  );
  return Number(result.rows[0]?.nextQueueNumber || 1);
}

async function createAppointment({
  patientId,
  doctorId,
  bookedByUserId,
  scheduledStart,
  scheduledEnd,
  appointmentType,
  consultationMode,
  reason,
  status,
  priority,
  queueNumber,
  waitingListRequested,
}) {
  const result = await db.query(
    `
      INSERT INTO appointments (
        patient_id,
        doctor_id,
        booked_by_user_id,
        scheduled_start,
        scheduled_end,
        appointment_type,
        consultation_mode,
        reason,
        status,
        priority,
        queue_number,
        waiting_list_requested
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      patientId,
      doctorId,
      bookedByUserId || null,
      scheduledStart,
      scheduledEnd,
      appointmentType,
      consultationMode,
      reason || null,
      status,
      priority,
      queueNumber,
      waitingListRequested || false,
    ]
  );
  return findAppointmentById(result.rows[0].id);
}

async function updateAppointmentSchedule(id, { scheduledStart, scheduledEnd, status }) {
  const result = await db.query(
    `
      UPDATE appointments
      SET
        scheduled_start = $2,
        scheduled_end = $3,
        status = $4
      WHERE id = $1
      RETURNING id
    `,
    [id, scheduledStart, scheduledEnd, status]
  );
  return result.rows[0] ? findAppointmentById(result.rows[0].id) : null;
}

async function updateAppointmentStatus(id, { status, cancellationReason, completedAt }) {
  const result = await db.query(
    `
      UPDATE appointments
      SET
        status = $2,
        cancellation_reason = $3,
        completed_at = $4
      WHERE id = $1
      RETURNING id
    `,
    [id, status, cancellationReason || null, completedAt || null]
  );
  return result.rows[0] ? findAppointmentById(result.rows[0].id) : null;
}

async function createWaitlistEntry({
  patientId,
  doctorId,
  preferredDate,
  preferredWindow,
  priority,
  reason,
}) {
  const result = await db.query(
    `
      INSERT INTO appointment_waitlist (
        patient_id,
        doctor_id,
        preferred_date,
        preferred_window,
        priority,
        reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING
        id,
        patient_id AS "patientId",
        doctor_id AS "doctorId",
        preferred_date AS "preferredDate",
        preferred_window AS "preferredWindow",
        priority,
        reason,
        status,
        created_at AS "createdAt"
    `,
    [
      patientId,
      doctorId,
      preferredDate,
      preferredWindow || null,
      priority,
      reason || null,
    ]
  );
  return result.rows[0];
}

async function listWaitlist({ doctorId } = {}) {
  const params = [];
  const where = [];
  if (doctorId) {
    params.push(doctorId);
    where.push(`wl.doctor_id = $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT
        wl.id,
        wl.patient_id AS "patientId",
        wl.doctor_id AS "doctorId",
        wl.preferred_date AS "preferredDate",
        wl.preferred_window AS "preferredWindow",
        wl.priority,
        wl.reason,
        wl.status,
        wl.created_at AS "createdAt",
        pu.full_name AS "patientName",
        pu.id AS "patientUserId",
        du.full_name AS "doctorName",
        du.id AS "doctorUserId"
      FROM appointment_waitlist wl
      JOIN patients p ON p.id = wl.patient_id
      JOIN users pu ON pu.id = p.user_id
      JOIN doctors d ON d.id = wl.doctor_id
      JOIN users du ON du.id = d.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY
        CASE wl.priority
          WHEN 'emergency' THEN 0
          WHEN 'urgent' THEN 1
          ELSE 2
        END,
        wl.created_at ASC
      LIMIT 100
    `,
    params
  );
  return result.rows;
}

async function findPromotableWaitlistEntry(doctorId, preferredDate) {
  const result = await db.query(
    `
      SELECT
        wl.id,
        wl.patient_id AS "patientId",
        wl.doctor_id AS "doctorId",
        wl.priority,
        pu.id AS "patientUserId"
      FROM appointment_waitlist wl
      JOIN patients p ON p.id = wl.patient_id
      JOIN users pu ON pu.id = p.user_id
      WHERE wl.doctor_id = $1
        AND wl.preferred_date = $2
        AND wl.status = 'waiting'
      ORDER BY
        CASE wl.priority
          WHEN 'emergency' THEN 0
          WHEN 'urgent' THEN 1
          ELSE 2
        END,
        wl.created_at ASC
      LIMIT 1
    `,
    [doctorId, preferredDate]
  );
  return result.rows[0] || null;
}

async function updateWaitlistStatus(id, status) {
  await db.query(
    `
      UPDATE appointment_waitlist
      SET
        status = $2,
        resolved_at = CASE WHEN $2 IN ('fulfilled', 'cancelled') THEN now() ELSE NULL END
      WHERE id = $1
    `,
    [id, status]
  );
}

module.exports = {
  listAppointmentsForScope,
  findAppointmentById,
  findActiveAppointmentConflict,
  listDoctorAppointmentsBetween,
  getNextQueueNumber,
  createAppointment,
  updateAppointmentSchedule,
  updateAppointmentStatus,
  createWaitlistEntry,
  listWaitlist,
  findPromotableWaitlistEntry,
  updateWaitlistStatus,
};
