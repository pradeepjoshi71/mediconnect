const db = require("../config/db");

async function findPatientById(id) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.emergency_contact_name AS "emergencyContactName",
        p.emergency_contact_phone AS "emergencyContactPhone",
        p.address,
        p.insurance_provider AS "insuranceProvider",
        p.insurance_member_id AS "insuranceMemberId",
        p.allergies,
        p.chronic_conditions AS "chronicConditions"
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function findPatientByUserId(userId) {
  const result = await db.query(
    `
      SELECT
        p.id,
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.emergency_contact_name AS "emergencyContactName",
        p.emergency_contact_phone AS "emergencyContactPhone",
        p.address,
        p.insurance_provider AS "insuranceProvider",
        p.insurance_member_id AS "insuranceMemberId",
        p.allergies,
        p.chronic_conditions AS "chronicConditions"
      FROM patients p
      JOIN users u ON u.id = p.user_id
      WHERE p.user_id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] || null;
}

async function listPatients(search = "") {
  const params = [];
  const where = [];

  if (search) {
    params.push(`%${search}%`);
    where.push(
      `(u.full_name ILIKE $${params.length} OR p.medical_record_number ILIKE $${params.length} OR u.email ILIKE $${params.length})`
    );
  }

  const result = await db.query(
    `
      SELECT
        p.id,
        p.user_id AS "userId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        p.medical_record_number AS "medicalRecordNumber",
        p.date_of_birth AS "dateOfBirth",
        p.gender,
        p.blood_group AS "bloodGroup",
        p.insurance_provider AS "insuranceProvider",
        p.allergies,
        p.chronic_conditions AS "chronicConditions"
      FROM patients p
      JOIN users u ON u.id = p.user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY u.full_name ASC
      LIMIT 100
    `,
    params
  );
  return result.rows;
}

module.exports = {
  findPatientById,
  findPatientByUserId,
  listPatients,
};
