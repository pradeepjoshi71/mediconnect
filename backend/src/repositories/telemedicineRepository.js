const db = require("../config/db");

async function findSessionByAppointmentId(appointmentId) {
  const result = await db.query(
    `
      SELECT
        id,
        appointment_id AS "appointmentId",
        provider,
        room_code AS "roomCode",
        join_url AS "joinUrl",
        status,
        created_at AS "createdAt",
        ended_at AS "endedAt"
      FROM telemedicine_sessions
      WHERE appointment_id = $1
      LIMIT 1
    `,
    [appointmentId]
  );
  return result.rows[0] || null;
}

async function createSession({ appointmentId, roomCode, joinUrl }) {
  const result = await db.query(
    `
      INSERT INTO telemedicine_sessions (appointment_id, room_code, join_url)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        appointment_id AS "appointmentId",
        provider,
        room_code AS "roomCode",
        join_url AS "joinUrl",
        status,
        created_at AS "createdAt",
        ended_at AS "endedAt"
    `,
    [appointmentId, roomCode, joinUrl]
  );
  return result.rows[0];
}

async function listMessages(appointmentId) {
  const result = await db.query(
    `
      SELECT
        tm.id,
        tm.appointment_id AS "appointmentId",
        tm.sender_user_id AS "senderUserId",
        tm.body,
        tm.created_at AS "createdAt",
        u.full_name AS "senderName"
      FROM telemedicine_messages tm
      JOIN users u ON u.id = tm.sender_user_id
      WHERE tm.appointment_id = $1
      ORDER BY tm.created_at ASC
      LIMIT 200
    `,
    [appointmentId]
  );
  return result.rows;
}

async function createMessage({ appointmentId, senderUserId, body }) {
  const result = await db.query(
    `
      INSERT INTO telemedicine_messages (appointment_id, sender_user_id, body)
      VALUES ($1, $2, $3)
      RETURNING
        id,
        appointment_id AS "appointmentId",
        sender_user_id AS "senderUserId",
        body,
        created_at AS "createdAt"
    `,
    [appointmentId, senderUserId, body]
  );
  return result.rows[0];
}

module.exports = {
  findSessionByAppointmentId,
  createSession,
  listMessages,
  createMessage,
};
