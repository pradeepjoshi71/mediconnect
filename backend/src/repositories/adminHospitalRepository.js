const db = require('../config/db');

async function listHospitals() {
  const result = await db.query(
    `SELECT id, code, slug, name, timezone, country_code AS "countryCode",
            support_phone AS "supportPhone", billing_email AS "billingEmail",
            status, settings, created_at AS "createdAt"
     FROM hospitals
     WHERE status IN ('active','trial')
     ORDER BY name ASC`
  );
  return result.rows;
}

async function getHospitalById(id) {
  const result = await db.query(
    `SELECT id, code, slug, name, timezone, country_code AS "countryCode",
            support_phone AS "supportPhone", billing_email AS "billingEmail",
            status, settings, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM hospitals WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getDepartmentsByHospital(hospitalId) {
  const result = await db.query(
    `SELECT d.id, d.hospital_id AS "hospitalId", d.department_code AS "code",
            d.department_name AS "name", d.description, d.status,
            d.head_doctor_id AS "headDoctorId",
            u.full_name AS "headDoctorName"
     FROM departments d
     LEFT JOIN doctors dr ON dr.id = d.head_doctor_id
     LEFT JOIN users u ON u.id = dr.user_id
     WHERE d.hospital_id = $1
     ORDER BY d.department_name ASC`,
    [hospitalId]
  );
  return result.rows;
}

async function createDepartment({ hospitalId, code, name, description, headDoctorId }) {
  const result = await db.query(
    `INSERT INTO departments (hospital_id, department_code, department_name, description, head_doctor_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (hospital_id, department_code) DO UPDATE
       SET department_name = EXCLUDED.department_name,
           description = EXCLUDED.description,
           head_doctor_id = EXCLUDED.head_doctor_id,
           updated_at = now()
     RETURNING *`,
    [hospitalId, code.toUpperCase(), name, description || null, headDoctorId || null]
  );
  return result.rows[0];
}

async function getAuditLogs({ hospitalId, action, userId, from, to, limit = 50, offset = 0 }) {
  const params = [hospitalId];
  const where = ['al.hospital_id = $1'];
  let idx = 2;
  if (action) { where.push(`al.action = $${idx++}`); params.push(action); }
  if (userId) { where.push(`al.user_id = $${idx++}`); params.push(userId); }
  if (from)   { where.push(`al.created_at >= $${idx++}`); params.push(from); }
  if (to)     { where.push(`al.created_at <= $${idx++}`); params.push(to); }

  params.push(limit, offset);

  const [logs, count] = await Promise.all([
    db.query(
      `SELECT al.id, al.action, al.entity_type AS "entityType", al.entity_id AS "entityId",
              al.actor_role AS "actorRole", al.ip_address AS "ipAddress",
              al.metadata, al.created_at AS "createdAt",
              u.full_name AS "userName", u.email AS "userEmail"
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${where.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    ),
    db.query(
      `SELECT COUNT(*) AS total FROM audit_logs al WHERE ${where.join(' AND ')}`,
      params.slice(0, -2)
    ),
  ]);

  return { logs: logs.rows, total: parseInt(count.rows[0].total), limit, offset };
}

module.exports = { listHospitals, getHospitalById, getDepartmentsByHospital, createDepartment, getAuditLogs };
