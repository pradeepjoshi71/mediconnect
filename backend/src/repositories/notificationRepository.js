const db = require("../config/db");

async function createNotification({
  userId,
  channel,
  eventType,
  title,
  body,
  data,
  status,
}) {
  const result = await db.query(
    `
      INSERT INTO notifications (
        user_id,
        channel,
        event_type,
        title,
        body,
        data,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING
        id,
        user_id AS "userId",
        channel,
        event_type AS "eventType",
        title,
        body,
        data,
        status,
        read_at AS "readAt",
        created_at AS "createdAt"
    `,
    [userId, channel, eventType, title, body || null, data || {}, status || "sent"]
  );
  return result.rows[0];
}

async function listNotifications(userId) {
  const result = await db.query(
    `
      SELECT
        id,
        user_id AS "userId",
        channel,
        event_type AS "eventType",
        title,
        body,
        data,
        status,
        read_at AS "readAt",
        created_at AS "createdAt"
      FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [userId]
  );
  return result.rows;
}

async function markRead(id, userId) {
  const result = await db.query(
    `
      UPDATE notifications
      SET
        read_at = now(),
        status = 'read'
      WHERE id = $1
        AND user_id = $2
      RETURNING
        id,
        user_id AS "userId",
        channel,
        event_type AS "eventType",
        title,
        body,
        data,
        status,
        read_at AS "readAt",
        created_at AS "createdAt"
    `,
    [id, userId]
  );
  return result.rows[0] || null;
}

async function markAllRead(userId) {
  await db.query(
    `
      UPDATE notifications
      SET
        read_at = now(),
        status = 'read'
      WHERE user_id = $1
        AND read_at IS NULL
    `,
    [userId]
  );
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
};
