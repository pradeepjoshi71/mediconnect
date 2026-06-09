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

async function updateSessionStatus(appointmentId, hospitalId, status) {
  const isEnded = status === "ended";
  const query = isEnded
    ? `UPDATE telemedicine_sessions
       SET status = $3, ended_at = now()
       WHERE appointment_id = $1 AND hospital_id = $2
       RETURNING id, hospital_id AS "hospitalId", appointment_id AS "appointmentId", provider, room_code AS "roomCode", join_url AS "joinUrl", status, created_at AS "createdAt", ended_at AS "endedAt"`
    : `UPDATE telemedicine_sessions
       SET status = $3
       WHERE appointment_id = $1 AND hospital_id = $2
       RETURNING id, hospital_id AS "hospitalId", appointment_id AS "appointmentId", provider, room_code AS "roomCode", join_url AS "joinUrl", status, created_at AS "createdAt", ended_at AS "endedAt"`;
  
  const result = await db.query(query, [appointmentId, hospitalId, status]);
  return result.rows[0] || null;
}

async function updateSessionNotes(appointmentId, hospitalId, notes) {
  const result = await db.query(
    `UPDATE telemedicine_sessions
     SET consultation_notes = $3
     WHERE appointment_id = $1 AND hospital_id = $2
     RETURNING id, hospital_id AS "hospitalId", appointment_id AS "appointmentId", provider, room_code AS "roomCode", join_url AS "joinUrl", status, consultation_notes AS "consultationNotes", created_at AS "createdAt", ended_at AS "endedAt"`,
    [appointmentId, hospitalId, notes]
  );
  return result.rows[0] || null;
}

async function updateSessionRecording(appointmentId, hospitalId, recordingMetadata) {
  const result = await db.query(
    `UPDATE telemedicine_sessions
     SET recording_metadata = $3
     WHERE appointment_id = $1 AND hospital_id = $2
     RETURNING id, hospital_id AS "hospitalId", appointment_id AS "appointmentId", provider, room_code AS "roomCode", join_url AS "joinUrl", status, recording_metadata AS "recordingMetadata", created_at AS "createdAt", ended_at AS "endedAt"`,
    [appointmentId, hospitalId, JSON.stringify(recordingMetadata)]
  );
  return result.rows[0] || null;
}

async function listSessionHistory(hospitalId, { doctorId, patientId } = {}) {
  const params = [hospitalId];
  let query = `
    SELECT
      ts.id,
      ts.hospital_id AS "hospitalId",
      ts.appointment_id AS "appointmentId",
      ts.room_code AS "roomCode",
      ts.join_url AS "joinUrl",
      ts.status,
      ts.consultation_notes AS "consultationNotes",
      ts.recording_metadata AS "recordingMetadata",
      ts.created_at AS "createdAt",
      ts.ended_at AS "endedAt",
      u_pat.full_name AS "patientName",
      u_doc.full_name AS "doctorName",
      a.scheduled_start AS "scheduledStart"
    FROM telemedicine_sessions ts
    JOIN appointments a ON a.id = ts.appointment_id
    JOIN patients p ON p.id = a.patient_id
    JOIN users u_pat ON u_pat.id = p.user_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users u_doc ON u_doc.id = d.user_id
    WHERE ts.hospital_id = $1
  `;

  if (doctorId) {
    params.push(doctorId);
    query += ` AND a.doctor_id = $${params.length}`;
  }

  if (patientId) {
    params.push(patientId);
    query += ` AND a.patient_id = $${params.length}`;
  }

  query += ` ORDER BY ts.created_at DESC LIMIT 100`;

  const result = await db.query(query, params);
  return result.rows;
}

module.exports = {
  findSessionByAppointmentId,
  createSession,
  listMessages,
  createMessage,
  updateSessionStatus,
  updateSessionNotes,
  updateSessionRecording,
  listSessionHistory,
};
