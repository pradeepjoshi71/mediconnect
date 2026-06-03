const db = require("../config/db");

async function listDocuments(patientId) {
  const result = await db.query(
    `SELECT
       id,
       patient_id,
       uploaded_by,
       file_name,
       file_path,
       document_type,
       uploaded_at
     FROM medical_documents
     WHERE patient_id = $1
     ORDER BY uploaded_at DESC`,
    [patientId]
  );
  return result.rows;
}

async function findDocumentById(id) {
  const result = await db.query(
    `SELECT * FROM medical_documents WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createDocument(data) {
  const result = await db.query(
    `INSERT INTO medical_documents (
       patient_id, uploaded_by, file_name, file_path, document_type
     )
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.patient_id,
      data.uploaded_by,
      data.file_name,
      data.file_path,
      data.document_type
    ]
  );
  return result.rows[0];
}

module.exports = {
  listDocuments,
  findDocumentById,
  createDocument,
};
