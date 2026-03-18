const db = require("../config/db");

const USER_SELECT = `
  SELECT
    u.id,
    u.full_name AS "fullName",
    u.email,
    u.phone,
    u.status,
    u.avatar_url AS "avatarUrl",
    u.password_hash AS "passwordHash",
    u.last_login_at AS "lastLoginAt",
    r.code AS role,
    p.id AS "patientProfileId",
    p.medical_record_number AS "medicalRecordNumber",
    p.date_of_birth AS "dateOfBirth",
    p.gender,
    d.id AS "doctorProfileId",
    d.specialization,
    d.department,
    d.consultation_fee_cents AS "consultationFeeCents"
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN patients p ON p.user_id = u.id
  LEFT JOIN doctors d ON d.user_id = u.id
`;

async function findUserByEmail(email) {
  const result = await db.query(
    `${USER_SELECT}
     WHERE lower(u.email) = lower($1)
     LIMIT 1`,
    [email]
  );
  return result.rows[0] || null;
}

async function findUserById(id) {
  const result = await db.query(
    `${USER_SELECT}
     WHERE u.id = $1
     LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function getRoleIdByCode(code) {
  const result = await db.query(
    `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
    [code]
  );
  return result.rows[0]?.id || null;
}

async function createPatientUser({
  fullName,
  email,
  passwordHash,
  phone,
  medicalRecordNumber,
  dateOfBirth,
  gender,
}) {
  return db.withTransaction(async (client) => {
    const roleId = await getRoleIdByCode("patient");
    const userResult = await client.query(
      `INSERT INTO users (role_id, full_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [roleId, fullName, email, passwordHash, phone || null]
    );

    await client.query(
      `INSERT INTO patients (user_id, medical_record_number, date_of_birth, gender)
       VALUES ($1, $2, $3, $4)`,
      [
        userResult.rows[0].id,
        medicalRecordNumber,
        dateOfBirth || null,
        gender || null,
      ]
    );

    const created = await client.query(
      `${USER_SELECT}
       WHERE u.id = $1
       LIMIT 1`,
      [userResult.rows[0].id]
    );

    return created.rows[0];
  });
}

async function insertRefreshToken({ userId, tokenHash, expiresAt }) {
  await db.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

async function findActiveRefreshTokenByHash(tokenHash) {
  const result = await db.query(
    `SELECT *
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function revokeRefreshTokenByHash(tokenHash) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );
}

async function touchLastLogin(userId) {
  await db.query(
    `UPDATE users
     SET last_login_at = now()
     WHERE id = $1`,
    [userId]
  );
}

module.exports = {
  findUserByEmail,
  findUserById,
  createPatientUser,
  insertRefreshToken,
  findActiveRefreshTokenByHash,
  revokeRefreshTokenByHash,
  touchLastLogin,
};
