const db = require("../config/db");

async function createNotification({
  hospitalId,
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
        hospital_id,
        user_id,
        channel,
        event_type,
        title,
        body,
        data,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        hospital_id AS "hospitalId",
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
    [hospitalId, userId, channel, eventType, title, body || null, data || {}, status || "sent"]
  );
  return result.rows[0];
}

async function listNotifications(hospitalId, userId) {
  const result = await db.query(
    `
      SELECT
        id,
        hospital_id AS "hospitalId",
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
      WHERE hospital_id = $1
        AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 100
    `,
    [hospitalId, userId]
  );
  return result.rows;
}

async function markRead(id, hospitalId, userId) {
  const result = await db.query(
    `
      UPDATE notifications
      SET
        read_at = now(),
        status = 'read'
      WHERE id = $1
        AND hospital_id = $2
        AND user_id = $3
      RETURNING
        id,
        hospital_id AS "hospitalId",
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
    [id, hospitalId, userId]
  );
  return result.rows[0] || null;
}

async function markAllRead(hospitalId, userId) {
  await db.query(
    `
      UPDATE notifications
      SET
        read_at = now(),
        status = 'read'
      WHERE hospital_id = $1
        AND user_id = $2
        AND read_at IS NULL
    `,
    [hospitalId, userId]
  );
}

module.exports = {
  createNotification,
  listNotifications,
  markRead,
  markAllRead,
};
