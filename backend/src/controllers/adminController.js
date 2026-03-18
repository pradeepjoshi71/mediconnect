const pool = require("../config/db");
const { z } = require("zod");

async function getAllUsers(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT id, full_name, email, role, created_at
      FROM users
      ORDER BY id ASC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching users:", error.message);
    res.status(500).json({ message: "Failed to fetch users" });
  }
}

async function getAllAppointments(req, res) {
  try {
    const result = await pool.query(
      `
      SELECT
        a.id,
        a.starts_at,
        a.ends_at,
        a.reason,
        a.status,
        p.full_name AS patient_name,
        d.full_name AS doctor_name
      FROM appointments a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id
      ORDER BY a.id DESC
      `
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching appointments:", error.message);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
}

async function createDoctor(req, res) {
  try {
    const schema = z.object({
      fullName: z.string().min(2).max(120),
      email: z.string().email().max(255),
      password: z.string().min(8).max(72),
      specialization: z.string().min(2).max(120),
      experienceYears: z.number().int().min(0).max(80).optional(),
      rating: z.number().min(0).max(5).optional(),
      bio: z.string().max(1000).optional(),
    });
    const data = schema.parse(req.body);

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [
      data.email,
    ]);
    if (existing.rows[0]) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const bcrypt = require("bcrypt");
    const passwordHash = await bcrypt.hash(data.password, 10);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const userRes = await client.query(
        `INSERT INTO users (full_name, email, password_hash, role)
         VALUES ($1,$2,$3,'doctor')
         RETURNING id, full_name, email, role, created_at`,
        [data.fullName, data.email, passwordHash]
      );
      const user = userRes.rows[0];

      const docRes = await client.query(
        `INSERT INTO doctors (user_id, specialization, experience_years, rating, bio)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [
          user.id,
          data.specialization,
          data.experienceYears ?? 0,
          data.rating ?? 4.5,
          data.bio ?? null,
        ]
      );

      await client.query("COMMIT");
      res.status(201).json({ user, doctor: docRes.rows[0] });
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: error.issues });
    }
    console.error("Error creating doctor:", error.message);
    res.status(500).json({ message: "Failed to create doctor" });
  }
}

module.exports = {
  getAllUsers,
  getAllAppointments,
  createDoctor,
};
