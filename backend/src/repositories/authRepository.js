const db = require("../config/db");

const USER_SELECT = `
  SELECT
    u.id,
    u.hospital_id AS "hospitalId",
    u.full_name AS "fullName",
    u.email,
    u.phone,
    u.status,
    u.avatar_url AS "avatarUrl",
    u.password_hash AS "passwordHash",
    u.last_login_at AS "lastLoginAt",
    u.failed_login_attempts AS "failedLoginAttempts",
    u.locked_until_at AS "lockedUntilAt",
    r.code AS role,
    h.code AS "hospitalCode",
    h.slug AS "hospitalSlug",
    h.name AS "hospitalName",
    h.timezone AS "hospitalTimezone",
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
  JOIN hospitals h ON h.id = u.hospital_id
  LEFT JOIN patients p ON p.user_id = u.id
  LEFT JOIN doctors d ON d.user_id = u.id
`;

async function findUserByEmail(email, hospitalId) {
  const result = await db.query(
    `${USER_SELECT}
     WHERE lower(u.email) = lower($1)
       AND u.hospital_id = $2
     LIMIT 1`,
    [email, hospitalId]
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

async function getRoleIdByCode(code, queryable = db) {
  const result = await queryable.query(
    `SELECT id FROM roles WHERE code = $1 LIMIT 1`,
    [code]
  );
  return result.rows[0]?.id || null;
}

async function createPatientUser({
  hospitalId,
  fullName,
  email,
  passwordHash,
  phone,
  medicalRecordNumber,
  dateOfBirth,
  gender,
}) {
  return db.withTransaction(async (client) => {
    const roleId = await getRoleIdByCode("patient", client);
    const userResult = await client.query(
      `INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone)
       VALUES ($1, $2, $3, lower($4), $5, $6)
       RETURNING id`,
      [hospitalId, roleId, fullName, email, passwordHash, phone || null]
    );

    const patientResult = await client.query(
      `INSERT INTO patients (hospital_id, user_id, medical_record_number, date_of_birth, gender)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        hospitalId,
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

async function insertRefreshToken({ hospitalId, userId, tokenHash, expiresAt }) {
  // ON CONFLICT handles the race condition where concurrent logins generate
  // tokens with the same hash (same JWT iat-second + same userId).
  // Upserts the expires_at so the session remains valid.
  await db.query(
    `INSERT INTO refresh_tokens (hospital_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (token_hash) DO UPDATE
       SET expires_at  = EXCLUDED.expires_at,
           revoked_at  = NULL`,
    [hospitalId, userId, tokenHash, expiresAt]
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

async function incrementFailedLogin(userId) {
  const result = await db.query(
    `UPDATE users
     SET failed_login_attempts = failed_login_attempts + 1,
         locked_until_at = CASE 
           WHEN failed_login_attempts + 1 >= 5 THEN now() + interval '15 minutes' 
           ELSE locked_until_at 
         END
     WHERE id = $1
     RETURNING failed_login_attempts AS "failedLoginAttempts", locked_until_at AS "lockedUntilAt"`,
    [userId]
  );
  return result.rows[0];
}

async function resetFailedLogin(userId) {
  await db.query(
    `UPDATE users
     SET failed_login_attempts = 0,
         locked_until_at = NULL
     WHERE id = $1`,
    [userId]
  );
}

async function createPasswordReset({ hospitalId, userId, tokenHash, expiresAt }) {
  await db.query(
    `INSERT INTO password_resets (hospital_id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [hospitalId, userId, tokenHash, expiresAt]
  );
}

async function findActivePasswordResetByHash(tokenHash) {
  const result = await db.query(
    `SELECT *
     FROM password_resets
     WHERE token_hash = $1
       AND used_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

async function markPasswordResetAsUsed(id) {
  await db.query(
    `UPDATE password_resets
     SET used_at = now()
     WHERE id = $1`,
    [id]
  );
}

async function updatePasswordHash(userId, passwordHash) {
  await db.query(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2`,
    [passwordHash, userId]
  );
}

async function revokeAllUserRefreshTokens(userId) {
  await db.query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE user_id = $1
       AND revoked_at IS NULL`,
    [userId]
  );
}

async function getUserPermissions(userId) {
  const result = await db.query(
    `SELECT DISTINCT p.code
     FROM user_roles ur
     JOIN role_permissions rp ON rp.role_id = ur.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE ur.user_id = $1
     UNION
     SELECT DISTINCT p.code
     FROM users u
     JOIN role_permissions rp ON rp.role_id = u.role_id
     JOIN permissions p ON p.id = rp.permission_id
     WHERE u.id = $1`,
    [userId]
  );
  return result.rows.map((row) => row.code);
}

module.exports = {
  findUserByEmail,
  findUserById,
  createPatientUser,
  insertRefreshToken,
  findActiveRefreshTokenByHash,
  revokeRefreshTokenByHash,
  touchLastLogin,
  incrementFailedLogin,
  resetFailedLogin,
  createPasswordReset,
  findActivePasswordResetByHash,
  markPasswordResetAsUsed,
  updatePasswordHash,
  revokeAllUserRefreshTokens,
  getUserPermissions,
};
