const db = require("../config/db");

async function listUsers(hospitalId) {
  const result = await db.query(
    `
      SELECT
        u.id,
        u.hospital_id AS "hospitalId",
        u.full_name AS "fullName",
        u.email,
        u.phone,
        u.status,
        r.code AS role,
        u.created_at AS "createdAt",
        d.id AS "doctorProfileId",
        d.specialization,
        d.department,
        p.id AS "patientProfileId",
        p.medical_record_number AS "medicalRecordNumber"
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN doctors d ON d.user_id = u.id
      LEFT JOIN patients p ON p.user_id = u.id
      WHERE u.hospital_id = $1
      ORDER BY u.created_at DESC
      LIMIT 200
    `,
    [hospitalId]
  );
  return result.rows;
}

async function getRoleIdByCode(code, queryable = db) {
  const result = await queryable.query(
    `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
    [code]
  );
  return result.rows[0]?.id || null;
}

async function createStaffUser({
  hospitalId,
  fullName,
  email,
  passwordHash,
  phone,
  role,
  specialization,
  department,
  employeeCode,
  licenseNumber,
  experienceYears,
  consultationFeeCents,
}) {
  return db.withTransaction(async (client) => {
    const roleId = await getRoleIdByCode(role, client);
    const userResult = await client.query(
      `
        INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
        VALUES ($1, $2, $3, lower($4), $5, $6, 'active')
        RETURNING id
      `,
      [hospitalId, roleId, fullName, email, passwordHash, phone || null]
    );

    if (role === "doctor") {
      await client.query(
        `
          INSERT INTO doctors (
            hospital_id,
            user_id,
            employee_code,
            specialization,
            department,
            license_number,
            experience_years,
            consultation_fee_cents
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          hospitalId,
          userResult.rows[0].id,
          employeeCode,
          specialization,
          department,
          licenseNumber,
          experienceYears,
          consultationFeeCents,
        ]
      );
    }

    const finalResult = await client.query(
      `
        SELECT
          u.id,
          u.hospital_id AS "hospitalId",
          u.full_name AS "fullName",
          u.email,
          u.phone,
          u.status,
          r.code AS role
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userResult.rows[0].id]
    );

    return finalResult.rows[0];
  });
}

module.exports = {
  listUsers,
  createStaffUser,
};
