const path = require("path");
const fs = require("fs");
const pool = require("../config/db");
const { z } = require("zod");

function canAccessReport(user, report) {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.id === report.uploader_id) return true;
  if (user.id === report.patient_id) return true;
  if (user.id === report.doctor_id) return true;
  return false;
}

async function listMyReports(req, res) {
  try {
    const user = req.user;
    const appointmentId = req.query.appointmentId ? Number(req.query.appointmentId) : null;
    let result;
    if (user.role === "admin") {
      if (appointmentId) {
        result = await pool.query(
          `SELECT * FROM reports WHERE appointment_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [appointmentId]
        );
      } else {
        result = await pool.query(`SELECT * FROM reports ORDER BY created_at DESC LIMIT 50`);
      }
    } else if (user.role === "doctor") {
      if (appointmentId) {
        result = await pool.query(
          `SELECT * FROM reports WHERE doctor_id = $1 AND appointment_id = $2 ORDER BY created_at DESC LIMIT 50`,
          [user.id, appointmentId]
        );
      } else {
        result = await pool.query(
          `SELECT * FROM reports WHERE doctor_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [user.id]
        );
      }
    } else {
      if (appointmentId) {
        result = await pool.query(
          `SELECT * FROM reports WHERE patient_id = $1 AND appointment_id = $2 ORDER BY created_at DESC LIMIT 50`,
          [user.id, appointmentId]
        );
      } else {
        result = await pool.query(
          `SELECT * FROM reports WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [user.id]
        );
      }
    }
    res.json(result.rows);
  } catch (e) {
    console.error("reports list:", e.message);
    res.status(500).json({ message: "Failed to fetch reports" });
  }
}

async function createReport(req, res) {
  try {
    if (!req.file) return res.status(400).json({ message: "Missing file" });

    const schema = z.object({
      patientId: z.coerce.number().int().positive().optional(),
      doctorId: z.coerce.number().int().positive().optional(),
      appointmentId: z.coerce.number().int().positive().optional(),
    });
    const meta = schema.parse(req.body || {});

    const file = req.file;
    const result = await pool.query(
      `INSERT INTO reports (
        uploader_id, patient_id, doctor_id, appointment_id,
        original_name, storage_name, mime_type, byte_size
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
      [
        req.user.id,
        meta.patientId || null,
        meta.doctorId || null,
        meta.appointmentId || null,
        file.originalname,
        file.filename,
        file.mimetype,
        file.size,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", issues: e.issues });
    }
    console.error("reports create:", e.message);
    res.status(500).json({ message: "Failed to upload report" });
  }
}

async function downloadReport(req, res) {
  try {
    const id = Number(req.params.id);
    const r = await pool.query(`SELECT * FROM reports WHERE id = $1`, [id]);
    const report = r.rows[0];
    if (!report) return res.status(404).json({ message: "Not found" });
    if (!canAccessReport(req.user, report)) return res.status(403).json({ message: "Forbidden" });

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
    const filePath = path.join(uploadsDir, report.storage_name);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: "File missing" });

    res.setHeader("Content-Type", report.mime_type);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(report.original_name)}"`
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    console.error("reports download:", e.message);
    res.status(500).json({ message: "Failed to download report" });
  }
}

module.exports = { listMyReports, createReport, downloadReport };

