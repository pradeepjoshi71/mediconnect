const pool = require("../config/db");
const { z } = require("zod");

function weekdayFromISODate(isoDate) {
  const d = new Date(`${isoDate}T00:00:00.000Z`);
  return d.getUTCDay(); // 0=Sun..6=Sat
}

function toTimeParts(t) {
  const [hh, mm] = t.split(":").map((x) => Number(x));
  return { hh, mm };
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

async function getMyRules(req, res) {
  try {
    const doctorId = req.user.id;
    const rows = await pool.query(
      `SELECT id, weekday, start_time, end_time, slot_minutes
       FROM doctor_availability_rules
       WHERE doctor_id = $1
       ORDER BY weekday ASC, start_time ASC`,
      [doctorId]
    );
    res.json(rows.rows);
  } catch (e) {
    console.error("availability get rules:", e.message);
    res.status(500).json({ message: "Failed to fetch availability" });
  }
}

async function setMyRules(req, res) {
  try {
    const doctorId = req.user.id;
    const schema = z.object({
      rules: z
        .array(
          z.object({
            weekday: z.number().int().min(0).max(6),
            startTime: z.string().regex(/^\d{2}:\d{2}$/),
            endTime: z.string().regex(/^\d{2}:\d{2}$/),
            slotMinutes: z.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v)),
          })
        )
        .max(42),
    });
    const { rules } = schema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM doctor_availability_rules WHERE doctor_id = $1", [doctorId]);
      for (const r of rules) {
        await client.query(
          `INSERT INTO doctor_availability_rules (doctor_id, weekday, start_time, end_time, slot_minutes)
           VALUES ($1,$2,$3,$4,$5)`,
          [doctorId, r.weekday, r.startTime, r.endTime, r.slotMinutes]
        );
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    res.status(204).send();
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: e.issues });
    }
    console.error("availability set rules:", e.message);
    res.status(500).json({ message: "Failed to update availability" });
  }
}

async function addTimeOff(req, res) {
  try {
    const doctorId = req.user.id;
    const schema = z.object({
      startsAt: z.string().datetime(),
      endsAt: z.string().datetime(),
      reason: z.string().max(500).optional(),
    });
    const { startsAt, endsAt, reason } = schema.parse(req.body);
    const result = await pool.query(
      `INSERT INTO doctor_time_off (doctor_id, starts_at, ends_at, reason)
       VALUES ($1,$2,$3,$4)
       RETURNING *`,
      [doctorId, startsAt, endsAt, reason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: e.issues });
    }
    console.error("availability add time off:", e.message);
    res.status(500).json({ message: "Failed to add time off" });
  }
}

async function listTimeOff(req, res) {
  try {
    const doctorId = req.user.id;
    const result = await pool.query(
      `SELECT * FROM doctor_time_off WHERE doctor_id = $1 ORDER BY starts_at DESC LIMIT 50`,
      [doctorId]
    );
    res.json(result.rows);
  } catch (e) {
    console.error("availability list time off:", e.message);
    res.status(500).json({ message: "Failed to fetch time off" });
  }
}

async function getDoctorSlots(req, res) {
  try {
    const doctorId = Number(req.params.doctorId);
    const schema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });
    const { date } = schema.parse(req.query);

    const wd = weekdayFromISODate(date);
    const rulesRes = await pool.query(
      `SELECT start_time, end_time, slot_minutes
       FROM doctor_availability_rules
       WHERE doctor_id = $1 AND weekday = $2
       ORDER BY start_time ASC`,
      [doctorId, wd]
    );
    if (!rulesRes.rows.length) return res.json({ slots: [] });

    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const offRes = await pool.query(
      `SELECT starts_at, ends_at
       FROM doctor_time_off
       WHERE doctor_id = $1
         AND starts_at < $3
         AND ends_at > $2`,
      [doctorId, dayStart.toISOString(), dayEnd.toISOString()]
    );

    const apptRes = await pool.query(
      `SELECT starts_at
       FROM appointments
       WHERE doctor_id = $1
         AND starts_at >= $2
         AND starts_at <= $3
         AND status IN ('pending','confirmed')`,
      [doctorId, dayStart.toISOString(), dayEnd.toISOString()]
    );
    const booked = new Set(apptRes.rows.map((r) => new Date(r.starts_at).toISOString()));

    const isInTimeOff = (t) =>
      offRes.rows.some((o) => new Date(o.starts_at) <= t && t < new Date(o.ends_at));

    const slots = [];
    for (const rule of rulesRes.rows) {
      const st = toTimeParts(rule.start_time);
      const et = toTimeParts(rule.end_time);
      const slotMinutes = Number(rule.slot_minutes);

      const start = new Date(dayStart);
      start.setUTCHours(st.hh, st.mm, 0, 0);
      const end = new Date(dayStart);
      end.setUTCHours(et.hh, et.mm, 0, 0);

      for (let t = start; t < end; t = addMinutes(t, slotMinutes)) {
        const iso = t.toISOString();
        if (booked.has(iso)) continue;
        if (isInTimeOff(t)) continue;
        slots.push(iso);
      }
    }

    res.json({ slots });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: e.issues });
    }
    console.error("availability get slots:", e.message);
    res.status(500).json({ message: "Failed to fetch slots" });
  }
}

module.exports = {
  getMyRules,
  setMyRules,
  addTimeOff,
  listTimeOff,
  getDoctorSlots,
};

