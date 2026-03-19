const db = require("../config/db");

async function findSessionByAppointmentId(hospitalId, appointmentId) {
  const result = await db.query(
    `
      SELECT
        id,
        hospital_id AS "hospitalId",
        appointment_id AS "appointmentId",
        provider,
        room_code AS "roomCode",
        join_url AS "joinUrl",
        status,
        created_at AS "createdAt",
        ended_at AS "endedAt"
      FROM telemedicine_sessions
      WHERE hospital_id = $1
        AND appointment_id = $2
      LIMIT 1
    `,
    [hospitalId, appointmentId]
  );
  return result.rows[0] || null;
}

async function createSession({ hospitalId, appointmentId, roomCode, joinUrl }) {
  const result = await db.query(
    `
      INSERT INTO telemedicine_sessions (hospital_id, appointment_id, room_code, join_url)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        hospital_id AS "hospitalId",
        appointment_id AS "appointmentId",
        provider,
        room_code AS "roomCode",
        join_url AS "joinUrl",
        status,
        created_at AS "createdAt",
        ended_at AS "endedAt"
    `,
    [hospitalId, appointmentId, roomCode, joinUrl]
  );
  return result.rows[0];
}

async function listMessages(hospitalId, appointmentId) {
  const result = await db.query(
    `
      SELECT
        tm.id,
        tm.hospital_id AS "hospitalId",
        tm.appointment_id AS "appointmentId",
        tm.sender_user_id AS "senderUserId",
        tm.body,
        tm.created_at AS "createdAt",
        u.full_name AS "senderName"
      FROM telemedicine_messages tm
      JOIN users u ON u.id = tm.sender_user_id
      WHERE tm.hospital_id = $1
        AND tm.appointment_id = $2
      ORDER BY tm.created_at ASC
      LIMIT 200
    `,
    [hospitalId, appointmentId]
  );
  return result.rows;
}

async function createMessage({ hospitalId, appointmentId, senderUserId, body }) {
  const result = await db.query(
    `
      INSERT INTO telemedicine_messages (hospital_id, appointment_id, sender_user_id, body)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        hospital_id AS "hospitalId",
        appointment_id AS "appointmentId",
        sender_user_id AS "senderUserId",
        body,
        created_at AS "createdAt"
    `,
    [hospitalId, appointmentId, senderUserId, body]
  );
  return result.rows[0];
}

module.exports = {
  findSessionByAppointmentId,
  createSession,
  listMessages,
  createMessage,
};
