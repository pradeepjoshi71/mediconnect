const db = require('../config/db');

/**
 * Save file metadata after a successful MinIO upload.
 */
async function createFileMetadata({ hospitalId, uploadedBy, bucketName, objectKey, originalName, mimeType, fileSize, resourceType, resourceId, isPublic }) {
  const result = await db.query(
    `INSERT INTO file_metadata
       (hospital_id, uploaded_by, bucket_name, object_key, original_name,
        mime_type, file_size, resource_type, resource_id, is_public)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [hospitalId, uploadedBy || null, bucketName, objectKey, originalName,
     mimeType || null, fileSize || null, resourceType || null, resourceId || null,
     isPublic || false]
  );
  return result.rows[0];
}

async function getFileMetadata(id) {
  const result = await db.query('SELECT * FROM file_metadata WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function listFileMetadata({ hospitalId, resourceType, resourceId }) {
  const params = [hospitalId];
  const where = ['hospital_id = $1'];
  let idx = 2;
  if (resourceType) { where.push(`resource_type = $${idx++}`); params.push(resourceType); }
  if (resourceId)   { where.push(`resource_id   = $${idx++}`); params.push(resourceId); }

  const result = await db.query(
    `SELECT * FROM file_metadata WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 200`,
    params
  );
  return result.rows;
}

async function deleteFileMetadata(id) {
  await db.query('DELETE FROM file_metadata WHERE id = $1', [id]);
}

module.exports = { createFileMetadata, getFileMetadata, listFileMetadata, deleteFileMetadata };
