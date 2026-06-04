const minioService = require('../services/minioService');
const fileMetadataRepo = require('../repositories/fileMetadataRepository');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('../utils/http');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES || '12582912', 10) },
});

/**
 * Maps resource_type (sent by the caller) → MinIO bucket name.
 *
 * Resource types:
 *   lab_report        → lab-reports
 *   prescription      → prescriptions
 *   invoice           → invoices
 *   patient_document  → patient-documents
 *   profile_image     → profile-images
 *   hospital_logo     → hospital-logos
 *   doctor_document   → doctor-documents
 */
const BUCKET_MAP = {
  lab_report:       'lab-reports',
  prescription:     'prescriptions',
  invoice:          'invoices',
  patient_document: 'patient-documents',
  profile_image:    'profile-images',
  hospital_logo:    'hospital-logos',
  doctor_document:  'doctor-documents',
};

const DEFAULT_BUCKET = 'patient-documents';

/**
 * POST /api/v1/storage/upload
 * Multipart upload — file goes to MinIO, metadata saved to DB.
 *
 * Body (form-data):
 *   file         — the file binary
 *   resourceType — one of the keys in BUCKET_MAP
 *   resourceId   — (optional) PK of the associated record
 */
async function uploadFile(req, res, next) {
  try {
    const { resourceType, resourceId } = req.body;
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded');

    const bucket = BUCKET_MAP[resourceType] || DEFAULT_BUCKET;
    const ext = path.extname(file.originalname) || '';
    const objectKey = `${resourceType || 'general'}/${uuidv4()}${ext}`;

    const { Readable } = require('stream');
    const stream = Readable.from(file.buffer);

    await minioService.uploadObject({
      bucket,
      objectKey,
      stream,
      size: file.size,
      mimeType: file.mimetype,
    });

    const meta = await fileMetadataRepo.createFileMetadata({
      hospitalId:   req.user.hospitalId,
      uploadedBy:   req.user.id,
      bucketName:   bucket,
      objectKey,
      originalName: file.originalname,
      mimeType:     file.mimetype,
      fileSize:     file.size,
      resourceType: resourceType || null,
      resourceId:   resourceId ? parseInt(resourceId, 10) : null,
      isPublic:     false,
    });

    res.status(201).json({ success: true, file: meta });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/storage/files/:id/url
 * Returns a pre-signed download URL for the requested file.
 * Validates hospital ownership before issuing the URL.
 *
 * Query param: expiry (seconds, default 3600, max 86400)
 */
async function getDownloadUrl(req, res, next) {
  try {
    const meta = await fileMetadataRepo.getFileMetadata(req.params.id);
    if (!meta) throw new AppError(404, 'File not found');

    // Tenant isolation — super_admin bypasses
    if (req.user.role !== 'super_admin' && meta.hospital_id !== req.user.hospitalId) {
      throw new AppError(403, 'Forbidden');
    }

    const rawExpiry = parseInt(req.query.expiry || '3600', 10);
    const expiry = Math.min(Math.max(rawExpiry, 60), 86400); // clamp 1 min – 24 hrs

    const url = await minioService.getPresignedUrl(meta.bucket_name, meta.object_key, expiry);
    res.json({ success: true, url, expiresIn: expiry });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/storage/files
 * List file metadata for the caller's hospital.
 *
 * Query params: resourceType, resourceId
 */
async function listFiles(req, res, next) {
  try {
    const { resourceType, resourceId } = req.query;
    const files = await fileMetadataRepo.listFileMetadata({
      hospitalId:   req.user.hospitalId,
      resourceType: resourceType || null,
      resourceId:   resourceId ? parseInt(resourceId, 10) : null,
    });
    res.json({ success: true, files });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/storage/files/:id
 * Deletes the object from MinIO and removes the metadata row.
 * Admin-only; validates hospital ownership.
 */
async function deleteFile(req, res, next) {
  try {
    const meta = await fileMetadataRepo.getFileMetadata(req.params.id);
    if (!meta) throw new AppError(404, 'File not found');

    if (req.user.role !== 'super_admin' && meta.hospital_id !== req.user.hospitalId) {
      throw new AppError(403, 'Forbidden');
    }

    await minioService.deleteObject(meta.bucket_name, meta.object_key);
    await fileMetadataRepo.deleteFileMetadata(req.params.id);
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, uploadFile, getDownloadUrl, listFiles, deleteFile };
