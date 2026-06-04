const db = require('../config/db');

async function upsertDeviceToken({ userId, hospitalId, fcmToken, platform = 'web' }) {
  const result = await db.query(
    `INSERT INTO device_tokens (user_id, hospital_id, fcm_token, platform, is_active)
     VALUES ($1, $2, $3, $4, TRUE)
     ON CONFLICT (user_id, fcm_token)
     DO UPDATE SET is_active = TRUE, platform = EXCLUDED.platform, updated_at = now()
     RETURNING *`,
    [userId, hospitalId, fcmToken, platform]
  );
  return result.rows[0];
}

async function deactivateToken(userId, fcmToken) {
  await db.query(
    `UPDATE device_tokens SET is_active = FALSE, updated_at = now()
     WHERE user_id = $1 AND fcm_token = $2`,
    [userId, fcmToken]
  );
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

module.exports = { upsertDeviceToken, deactivateToken, getActiveTokensForUser, getActiveTokensForUsers };
