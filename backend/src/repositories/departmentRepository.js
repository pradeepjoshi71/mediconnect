const db = require("../config/db");

async function createDepartment({ hospitalId, code, name, description, headUserId }) {
  const result = await db.query(
    `INSERT INTO departments (hospital_id, code, name, description, head_user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, hospital_id AS "hospitalId", code, name, description, head_user_id AS "headUserId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [hospitalId, code, name, description || null, headUserId || null]
  );
  return result.rows[0];
}

async function listDepartments(hospitalId) {
  const result = await db.query(
    `SELECT
       d.id,
       d.hospital_id AS "hospitalId",
       d.code,
       d.name,
       d.description,
       d.head_user_id AS "headUserId",
       u.full_name AS "headFullName",
       u.email AS "headEmail",
       (SELECT COUNT(*)::int FROM department_members dm WHERE dm.department_id = d.id) AS "memberCount",
       d.created_at AS "createdAt",
       d.updated_at AS "updatedAt"
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_user_id
     WHERE d.hospital_id = $1
     ORDER BY d.name ASC`,
    [hospitalId]
  );
  return result.rows;
}

async function findDepartmentById(id, hospitalId) {
  const result = await db.query(
    `SELECT
       d.id,
       d.hospital_id AS "hospitalId",
       d.code,
       d.name,
       d.description,
       d.head_user_id AS "headUserId",
       u.full_name AS "headFullName",
       u.email AS "headEmail",
       d.created_at AS "createdAt",
       d.updated_at AS "updatedAt"
     FROM departments d
     LEFT JOIN users u ON u.id = d.head_user_id
     WHERE d.id = $1 AND d.hospital_id = $2
     LIMIT 1`,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

async function findDepartmentByCode(code, hospitalId) {
  const result = await db.query(
    `SELECT id FROM departments WHERE code = $1 AND hospital_id = $2 LIMIT 1`,
    [code, hospitalId]
  );
  return result.rows[0] || null;
}

async function updateDepartment(id, hospitalId, { name, description, headUserId }) {
  const result = await db.query(
    `UPDATE departments
     SET name = $1, description = $2, head_user_id = $3, updated_at = now()
     WHERE id = $4 AND hospital_id = $5
     RETURNING id, hospital_id AS "hospitalId", code, name, description, head_user_id AS "headUserId", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [name, description || null, headUserId || null, id, hospitalId]
  );
  return result.rows[0] || null;
}

async function deleteDepartment(id, hospitalId) {
  const result = await db.query(
    `DELETE FROM departments WHERE id = $1 AND hospital_id = $2`,
    [id, hospitalId]
  );
  return result.rowCount > 0;
}

async function addDepartmentMember(departmentId, userId) {
  const result = await db.query(
    `INSERT INTO department_members (department_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING department_id AS "departmentId", user_id AS "userId"`,
    [departmentId, userId]
  );
  return result.rows[0] || null;
}

async function removeDepartmentMember(departmentId, userId) {
  const result = await db.query(
    `DELETE FROM department_members WHERE department_id = $1 AND user_id = $2`,
    [departmentId, userId]
  );
  return result.rowCount > 0;
}

async function listDepartmentMembers(departmentId, hospitalId) {
  const result = await db.query(
    `SELECT
       u.id,
       u.full_name AS "fullName",
       u.email,
       u.phone,
       u.status,
       r.code AS role
     FROM department_members dm
     JOIN users u ON u.id = dm.user_id
     JOIN roles r ON r.id = u.role_id
     JOIN departments d ON d.id = dm.department_id
     WHERE dm.department_id = $1 AND d.hospital_id = $2
     ORDER BY u.full_name ASC`,
    [departmentId, hospitalId]
  );
  return result.rows;
}

async function getDepartmentAnalytics(hospitalId) {
  const result = await db.query(
    `SELECT
       d.id,
       d.name,
       d.code,
       (SELECT COUNT(*)::int FROM department_members dm WHERE dm.department_id = d.id) AS "memberCount",
       (
         SELECT COUNT(*)::int
         FROM department_members dm
         JOIN users u ON u.id = dm.user_id
         JOIN roles r ON r.id = u.role_id
         WHERE dm.department_id = d.id AND r.code = 'doctor'
       ) AS "doctorCount"
     FROM departments d
     WHERE d.hospital_id = $1
     ORDER BY d.name ASC`,
    [hospitalId]
  );
  return result.rows;
}

module.exports = {
  createDepartment,
  listDepartments,
  findDepartmentById,
  findDepartmentByCode,
  updateDepartment,
  deleteDepartment,
  addDepartmentMember,
  removeDepartmentMember,
  listDepartmentMembers,
  getDepartmentAnalytics,
};
