const db = require('../config/db');

async function upsertDeviceToken({ userId, hospitalId, fcmToken, deviceToken, platform = 'web' }) {
  const tokenValue = fcmToken || deviceToken;
  const result = await db.query(
    `INSERT INTO device_tokens (user_id, hospital_id, fcm_token, platform, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (user_id, fcm_token)
     DO UPDATE SET is_active = TRUE, platform = EXCLUDED.platform, updated_at = now()
     RETURNING id, user_id AS "userId", hospital_id AS "hospitalId", fcm_token AS "deviceToken", platform, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, hospitalId, tokenValue, platform]
  );
  return result.rows[0];
}

async function deactivateToken(userId, deviceToken) {
  const result = await db.query(
    `UPDATE device_tokens SET is_active = FALSE, updated_at = now()
     WHERE user_id = $1 AND fcm_token = $2
     RETURNING id, user_id AS "userId", hospital_id AS "hospitalId", fcm_token AS "deviceToken", platform, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"`,
    [userId, deviceToken]
  );
  return result.rows[0];
}

async function getActiveTokensForUser(userId) {
  const result = await db.query(
    `SELECT fcm_token, platform FROM device_tokens
     WHERE user_id = $1 AND is_active = TRUE`,
    [userId]
  );
  return result.rows;
}

async function getActiveTokensForUsers(userIds) {
  if (!userIds || userIds.length === 0) return [];
  const result = await db.query(
    `SELECT user_id, fcm_token, platform FROM device_tokens
     WHERE user_id = ANY($1) AND is_active = TRUE`,
    [userIds]
  );
  return result.rows;
}

async function getActiveTokensForHospital(hospitalId) {
  const result = await db.query(
    `SELECT user_id, fcm_token, platform FROM device_tokens
     WHERE hospital_id = $1 AND is_active = TRUE`,
    [hospitalId]
  );
  return result.rows;
}

async function listDeviceTokens({ userId, hospitalId, limit = 50, offset = 0 }) {
  let query = `
    SELECT id, user_id AS "userId", hospital_id AS "hospitalId", fcm_token AS "deviceToken", platform, is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM device_tokens
    WHERE 1=1
  `;
  const params = [];

  if (userId) {
    params.push(userId);
    query += ` AND user_id = $${params.length}`;
  }

  if (hospitalId) {
    params.push(hospitalId);
    query += ` AND hospital_id = $${params.length}`;
  }

  params.push(limit, offset);
  query += ` ORDER BY updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const result = await db.query(query, params);
  return result.rows;
}

module.exports = {
  upsertDeviceToken,
  deactivateToken,
  getActiveTokensForUser,
  getActiveTokensForUsers,
  getActiveTokensForHospital,
  listDeviceTokens,
};
