const db = require("../config/db");

async function createFileRecord({
  hospitalId,
  patientId,
  appointmentId,
  medicalRecordId,
  uploadedByUserId,
  fileCategory,
  originalName,
  storageName,
  mimeType,
  byteSize,
  accessScope,
}) {
  const result = await db.query(
    `
      INSERT INTO files (
        hospital_id,
        patient_id,
        appointment_id,
        medical_record_id,
        uploaded_by_user_id,
        file_category,
        original_name,
        storage_name,
        mime_type,
        byte_size,
        access_scope
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        hospital_id AS "hospitalId",
        patient_id AS "patientId",
        appointment_id AS "appointmentId",
        medical_record_id AS "medicalRecordId",
        uploaded_by_user_id AS "uploadedByUserId",
        file_category AS "fileCategory",
        original_name AS "originalName",
        storage_name AS "storageName",
        mime_type AS "mimeType",
        byte_size AS "byteSize",
        access_scope AS "accessScope",
        created_at AS "createdAt"
    `,
    [
      hospitalId,
      patientId || null,
      appointmentId || null,
      medicalRecordId || null,
      uploadedByUserId,
      fileCategory,
      originalName,
      storageName,
      mimeType,
      byteSize,
      accessScope,
    ]
  );
  return result.rows[0];
}

async function listFiles({ hospitalId, patientId, appointmentId, medicalRecordId } = {}) {
  const where = [`f.hospital_id = $1`];
  const params = [hospitalId];

  if (patientId) {
    params.push(patientId);
    where.push(`f.patient_id = $${params.length}`);
  }
  if (appointmentId) {
    params.push(appointmentId);
    where.push(`f.appointment_id = $${params.length}`);
  }
  if (medicalRecordId) {
    params.push(medicalRecordId);
    where.push(`f.medical_record_id = $${params.length}`);
  }

  const result = await db.query(
    `
      SELECT
        f.id,
        f.hospital_id AS "hospitalId",
        f.patient_id AS "patientId",
        f.appointment_id AS "appointmentId",
        f.medical_record_id AS "medicalRecordId",
        f.uploaded_by_user_id AS "uploadedByUserId",
        uploader.full_name AS "uploadedByName",
        f.file_category AS "fileCategory",
        f.original_name AS "originalName",
        f.storage_name AS "storageName",
        f.mime_type AS "mimeType",
        f.byte_size AS "byteSize",
        f.access_scope AS "accessScope",
        f.created_at AS "createdAt"
      FROM files f
      JOIN users uploader ON uploader.id = f.uploaded_by_user_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY f.created_at DESC
      LIMIT 100
    `,
    params
  );
  return result.rows;
}

async function findFileById(id, hospitalId) {
  const result = await db.query(
    `
      SELECT
        f.*,
        p.user_id AS patient_user_id
      FROM files f
      LEFT JOIN patients p ON p.id = f.patient_id
      WHERE f.id = $1
        AND f.hospital_id = $2
      LIMIT 1
    `,
    [id, hospitalId]
  );
  return result.rows[0] || null;
}

module.exports = {
  createFileRecord,
  listFiles,
  findFileById,
};
