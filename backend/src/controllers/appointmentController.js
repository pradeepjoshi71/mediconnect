const pool = require("../config/db");
const { z } = require("zod");
const { safeEmitToUser } = require("../realtime/io");

async function createNotification({ userId, type, title, body }) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, type, title, body)
     VALUES ($1,$2,$3,$4)
     RETURNING *`,
    [userId, type, title, body || null]
  );
  return result.rows[0];
}

async function bookAppointment(req, res) {
  try {
    const patientId = req.user.id;
    const schema = z.object({
      doctorId: z.number().int().positive(),
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().min(2).max(500).optional(),
    });
    const { doctorId, startsAt, endsAt, reason } = schema.parse(req.body);

    const doctorCheck = await pool.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [doctorId]
    );

    if (doctorCheck.rows.length === 0) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    if (doctorCheck.rows[0].role !== "doctor") {
      return res.status(400).json({ message: "Selected user is not a doctor" });
    }

    // Enforce availability rules + time off
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const weekday = start.getUTCDay();

    const rulesRes = await pool.query(
      `SELECT start_time, end_time, slot_minutes
       FROM doctor_availability_rules
       WHERE doctor_id = $1 AND weekday = $2
       ORDER BY start_time ASC`,
      [doctorId, weekday]
    );

    const fitsRule = rulesRes.rows.some((r) => {
      const [sh, sm] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      const slotMinutes = Number(r.slot_minutes);

      const ruleStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), sh, sm, 0, 0));
      const ruleEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate(), eh, em, 0, 0));

      const duration = (end.getTime() - start.getTime()) / (60 * 1000);
      if (duration !== slotMinutes) return false;
      return start >= ruleStart && end <= ruleEnd;
    });

    if (!fitsRule) {
      return res.status(409).json({ message: "That slot is not available for this doctor" });
    }

    const offRes = await pool.query(
      `SELECT 1
       FROM doctor_time_off
       WHERE doctor_id = $1
         AND starts_at < $3
         AND ends_at > $2
       LIMIT 1`,
      [doctorId, startsAt, endsAt]
    );
    if (offRes.rows[0]) {
      return res.status(409).json({ message: "Doctor is unavailable at that time" });
    }

    const result = await pool.query(
      `INSERT INTO appointments (patient_id, doctor_id, starts_at, ends_at, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [patientId, doctorId, startsAt, endsAt, reason || null]
    );

    const appointment = result.rows[0];
    const n1 = await createNotification({
      userId: patientId,
      type: "appointment.booked",
      title: "Appointment requested",
      body: `Your appointment request was sent.`,
    });
    const n2 = await createNotification({
      userId: doctorId,
      type: "appointment.requested",
      title: "New appointment request",
      body: `A patient requested a new appointment.`,
    });
    safeEmitToUser(patientId, "notification:new", n1);
    safeEmitToUser(doctorId, "notification:new", n2);

    res.status(201).json({
      message: "Appointment booked successfully",
      appointment,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "That time slot is already booked" });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("Error booking appointment:", error.message);
    res.status(500).json({ message: "Failed to book appointment" });
  }
}

async function listMyAppointments(req, res) {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    let result;
    if (role === "doctor") {
      result = await pool.query(
        `
        SELECT
          a.*,
          p.full_name AS patient_name,
          d.full_name AS doctor_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.doctor_id = $1
        ORDER BY a.starts_at DESC
        `,
        [userId]
      );
    } else if (role === "admin") {
      result = await pool.query(
        `
        SELECT
          a.*,
          p.full_name AS patient_name,
          d.full_name AS doctor_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        ORDER BY a.starts_at DESC
        `
      );
    } else {
      result = await pool.query(
        `
        SELECT
          a.*,
          p.full_name AS patient_name,
          d.full_name AS doctor_name
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        JOIN users d ON a.doctor_id = d.id
        WHERE a.patient_id = $1
        ORDER BY a.starts_at DESC
        `,
        [userId]
      );
    }

    res.json(result.rows);
  } catch (error) {
    console.error("Error listing appointments:", error.message);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
}

async function cancelAppointment(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;

    const result = await pool.query(
      `
      UPDATE appointments
      SET status = 'cancelled', updated_at = now()
      WHERE id = $1
        AND (patient_id = $2 OR $3 = 'admin')
        AND status IN ('pending','confirmed')
      RETURNING *
      `,
      [id, userId, req.user.role]
    );

    const appointment = result.rows[0];
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const n = await createNotification({
      userId: appointment.doctor_id,
      type: "appointment.cancelled",
      title: "Appointment cancelled",
      body: "A patient cancelled an appointment.",
    });
    safeEmitToUser(appointment.doctor_id, "notification:new", n);

    res.json({ message: "Appointment cancelled", appointment });
  } catch (error) {
    console.error("Error cancelling appointment:", error.message);
    res.status(500).json({ message: "Failed to cancel appointment" });
  }
}

async function rescheduleAppointment(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const schema = z.object({
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
    });
    const { startsAt, endsAt } = schema.parse(req.body);

    // Fetch appointment to enforce availability against the correct doctor
    const apptRes = await pool.query(`SELECT * FROM appointments WHERE id = $1`, [id]);
    const existing = apptRes.rows[0];
    if (!existing) return res.status(404).json({ message: "Appointment not found" });

    if (req.user.role !== "admin" && existing.patient_id !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const doctorId = existing.doctor_id;
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    const weekday = start.getUTCDay();

    const rulesRes = await pool.query(
      `SELECT start_time, end_time, slot_minutes
       FROM doctor_availability_rules
       WHERE doctor_id = $1 AND weekday = $2
       ORDER BY start_time ASC`,
      [doctorId, weekday]
    );

    const fitsRule = rulesRes.rows.some((r) => {
      const [sh, sm] = r.start_time.split(":").map(Number);
      const [eh, em] = r.end_time.split(":").map(Number);
      const slotMinutes = Number(r.slot_minutes);

      const ruleStart = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate(),
          sh,
          sm,
          0,
          0
        )
      );
      const ruleEnd = new Date(
        Date.UTC(
          start.getUTCFullYear(),
          start.getUTCMonth(),
          start.getUTCDate(),
          eh,
          em,
          0,
          0
        )
      );

      const duration = (end.getTime() - start.getTime()) / (60 * 1000);
      if (duration !== slotMinutes) return false;
      return start >= ruleStart && end <= ruleEnd;
    });

    if (!fitsRule) {
      return res.status(409).json({ message: "That slot is not available for this doctor" });
    }

    const offRes = await pool.query(
      `SELECT 1
       FROM doctor_time_off
       WHERE doctor_id = $1
         AND starts_at < $3
         AND ends_at > $2
       LIMIT 1`,
      [doctorId, startsAt, endsAt]
    );
    if (offRes.rows[0]) {
      return res.status(409).json({ message: "Doctor is unavailable at that time" });
    }

    const result = await pool.query(
      `
      UPDATE appointments
      SET starts_at = $1, ends_at = $2, status = 'pending', updated_at = now()
      WHERE id = $3
        AND (patient_id = $4 OR $5 = 'admin')
        AND status IN ('pending','confirmed')
      RETURNING *
      `,
      [startsAt, endsAt, id, userId, req.user.role]
    );

    const appointment = result.rows[0];
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const n = await createNotification({
      userId: appointment.doctor_id,
      type: "appointment.rescheduled",
      title: "Appointment rescheduled",
      body: "A patient rescheduled an appointment.",
    });
    safeEmitToUser(appointment.doctor_id, "notification:new", n);

    res.json({ message: "Appointment rescheduled", appointment });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({ message: "That time slot is already booked" });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("Error rescheduling appointment:", error.message);
    res.status(500).json({ message: "Failed to reschedule appointment" });
  }
}

async function updateStatus(req, res) {
  try {
    const id = Number(req.params.id);
    const userId = req.user.id;
    const schema = z.object({
      status: z.enum(["pending", "confirmed", "cancelled", "completed"]),
    });
    const { status } = schema.parse(req.body);

    const result = await pool.query(
      `
      UPDATE appointments
      SET status = $1, updated_at = now()
      WHERE id = $2 AND (doctor_id = $3 OR $4 = 'admin')
      RETURNING *
      `,
      [status, id, userId, req.user.role]
    );

    const appointment = result.rows[0];
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    const n = await createNotification({
      userId: appointment.patient_id,
      type: "appointment.status",
      title: "Appointment updated",
      body: `Your appointment is now ${appointment.status}.`,
    });
    safeEmitToUser(appointment.patient_id, "notification:new", n);

    res.json({ message: "Status updated", appointment });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("Error updating appointment status:", error.message);
    res.status(500).json({ message: "Failed to update status" });
  }
}

module.exports = {
  bookAppointment,
  listMyAppointments,
  cancelAppointment,
  rescheduleAppointment,
  updateStatus,
};

