const pool = require("../config/db");

async function findUserByEmail(email) {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  return result.rows[0];
}

async function findUserById(id) {
  const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return result.rows[0];
}

async function createUser(fullName, email, passwordHash) {
  const result = await pool.query(
    `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name, email, role, avatar_url, created_at`,
    [fullName, email, passwordHash]
  );
  return result.rows[0];
}

async function insertRefreshToken({ userId, tokenHash, expiresAt }) {
  const result = await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING id, user_id, token_hash, expires_at, revoked_at, created_at`,
    [userId, tokenHash, expiresAt]
  );
  return result.rows[0];
}

async function findActiveRefreshTokenByHash(tokenHash) {
  const result = await pool.query(
    `SELECT *
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  return result.rows[0];
}

async function revokeRefreshTokenByHash(tokenHash) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash]
  );
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  insertRefreshToken,
  findActiveRefreshTokenByHash,
  revokeRefreshTokenByHash,
};