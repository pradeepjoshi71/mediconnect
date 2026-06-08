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

async function createApplication({ hospitalName, contactPerson, email, phone, address, hospitalType, numberOfDoctors }) {
  const result = await db.query(
    `INSERT INTO hospital_applications (hospital_name, contact_person, email, phone, address, hospital_type, number_of_doctors)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, hospital_name AS "hospitalName", contact_person AS "contactPerson", email, phone, address, hospital_type AS "hospitalType", number_of_doctors AS "numberOfDoctors", status, created_at AS "createdAt"`,
    [hospitalName, contactPerson, email, phone, address, hospitalType, numberOfDoctors]
  );
  return result.rows[0];
}

async function listApplications({ search = "" }) {
  const params = [];
  let queryStr = `SELECT id, hospital_name AS "hospitalName", contact_person AS "contactPerson", email, phone, address, hospital_type AS "hospitalType", number_of_doctors AS "numberOfDoctors", status, created_at AS "createdAt" FROM hospital_applications`;
  if (search) {
    queryStr += ` WHERE lower(hospital_name) LIKE lower($1) OR lower(contact_person) LIKE lower($1)`;
    params.push(`%${search}%`);
  }
  queryStr += ` ORDER BY status = 'pending' DESC, created_at DESC`;
  const result = await db.query(queryStr, params);
  return result.rows;
}

async function getApplicationById(id) {
  const result = await db.query(
    `SELECT id, hospital_name AS "hospitalName", contact_person AS "contactPerson", email, phone, address, hospital_type AS "hospitalType", number_of_doctors AS "numberOfDoctors", status, created_at AS "createdAt"
     FROM hospital_applications WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
}

async function updateApplicationStatus(id, status) {
  const result = await db.query(
    `UPDATE hospital_applications SET status = $1, updated_at = now() WHERE id = $2 RETURNING id, status`,
    [status, id]
  );
  return result.rows[0];
}

async function getApplicationStats() {
  const totalHospitalsRes = await db.query(`SELECT COUNT(*) AS count FROM hospitals WHERE status IN ('active', 'trial')`);
  const pendingRes = await db.query(`SELECT COUNT(*) AS count FROM hospital_applications WHERE status = 'pending'`);
  const activeTenantsRes = await db.query(`SELECT COUNT(*) AS count FROM hospitals WHERE status = 'active'`);
  return {
    totalHospitals: parseInt(totalHospitalsRes.rows[0].count, 10),
    pendingApprovals: parseInt(pendingRes.rows[0].count, 10),
    activeTenants: parseInt(activeTenantsRes.rows[0].count, 10)
  };
}

async function createHospitalTenant({ code, slug, name, timezone, countryCode, supportPhone, billingEmail, status, settings }) {
  const result = await db.query(
    `INSERT INTO hospitals (code, slug, name, timezone, country_code, support_phone, billing_email, status, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id`,
    [code, slug, name, timezone, countryCode, supportPhone, billingEmail, status, JSON.stringify(settings || {})]
  );
  return result.rows[0];
}

async function createDefaultAdmin({ hospitalId, roleId, fullName, email, passwordHash, phone }) {
  const result = await db.query(
    `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING id`,
    [hospitalId, roleId, fullName, email, passwordHash, phone]
  );
  const userId = result.rows[0].id;
  await db.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, roleId]
  );
  return userId;
}

async function getAdminRoleId() {
  const result = await db.query(`SELECT id FROM roles WHERE code = 'admin' LIMIT 1`);
  return result.rows[0]?.id || null;
}

module.exports = {
  listHospitals,
  getHospitalById,
  getDepartmentsByHospital,
  createDepartment,
  getAuditLogs,
  createApplication,
  listApplications,
  getApplicationById,
  updateApplicationStatus,
  getApplicationStats,
  createHospitalTenant,
  createDefaultAdmin,
  getAdminRoleId,
  getBranding,
  saveBranding
};

async function getBranding(hospitalId) {
  const r = await db.query(
    `SELECT settings->'branding' AS branding, name, code FROM hospitals WHERE id = $1`,
    [hospitalId]
  );
  return r.rows[0] || null;
}

async function saveBranding(hospitalId, branding) {
  const r = await db.query(
    `UPDATE hospitals
     SET settings = jsonb_set(
       COALESCE(settings, '{}'::jsonb),
       '{branding}',
       $2::jsonb,
       true
     )
     WHERE id = $1
     RETURNING id, name, settings->'branding' AS branding`,
    [hospitalId, JSON.stringify(branding)]
  );
  return r.rows[0] || null;
}

