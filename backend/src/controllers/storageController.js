const minioService = require('../services/minioService');
const fileMetadataRepo = require('../repositories/fileMetadataRepository');
const auditService = require('../services/auditService');
const db = require('../config/db');
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
 */
async function uploadFile(req, res, next) {
  try {
    const { resourceType, resourceId } = req.body;
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded');

    // Role-based upload validation
    if (req.user.role === 'patient') {
      const allowedPatientTypes = ['patient_document', 'profile_image'];
      if (!allowedPatientTypes.includes(resourceType)) {
        throw new AppError(403, 'Forbidden: Patients are only allowed to upload patient_document or profile_image');
      }
    }

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

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'storage.file.upload',
      entityType: 'file_metadata',
      entityId: meta.id,
      metadata: {
        fileName: file.originalname,
        bucketName: bucket,
        objectKey,
        resourceType: resourceType || null,
        resourceId: resourceId ? parseInt(resourceId, 10) : null,
      },
      context: req.auditContext,
    });

    res.status(201).json({ success: true, file: meta });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/storage/files/:id/url
 */
async function getDownloadUrl(req, res, next) {
  try {
    const meta = await fileMetadataRepo.getFileMetadata(req.params.id);
    if (!meta) throw new AppError(404, 'File not found');

    // Tenant isolation — super_admin bypasses
    if (req.user.role !== 'super_admin' && meta.hospital_id !== req.user.hospitalId) {
      throw new AppError(403, 'Forbidden');
    }

    // Role-based download validation for patients
    if (req.user.role === 'patient') {
      // Patients must never access doctor documents, hospital documents/logos, or administrative files
      const forbiddenResourceTypes = ['doctor_document', 'hospital_logo', 'administrative_document'];
      if (forbiddenResourceTypes.includes(meta.resource_type)) {
        throw new AppError(403, 'Forbidden: Patients are not allowed to access this resource type');
      }

      const isOwner = meta.uploaded_by === req.user.id;
      let isAuthorized = isOwner;

      if (!isAuthorized && meta.resource_type && meta.resource_id) {
        const resId = parseInt(meta.resource_id, 10);
        if (!isNaN(resId)) {
          if (meta.resource_type === 'patient_document') {
            isAuthorized = resId === req.user.patientProfileId;
          } else if (meta.resource_type === 'invoice') {
            const result = await db.query('SELECT patient_id AS "patientId" FROM invoices WHERE id = $1', [resId]);
            isAuthorized = result.rows[0]?.patientId === req.user.patientProfileId;
          } else if (meta.resource_type === 'prescription') {
            const result = await db.query('SELECT patient_id AS "patientId" FROM prescriptions WHERE id = $1', [resId]);
            isAuthorized = result.rows[0]?.patientId === req.user.patientProfileId;
          } else if (meta.resource_type === 'lab_report') {
            const result = await db.query('SELECT patient_id AS "patientId" FROM lab_reports WHERE id = $1', [resId]);
            isAuthorized = result.rows[0]?.patientId === req.user.patientProfileId;
          } else if (meta.resource_type === 'profile_image') {
            isAuthorized = resId === req.user.id;
          }
        }
      }

      if (!isAuthorized) {
        throw new AppError(403, 'Forbidden: You do not have permission to access this file');
      }
    }

    const rawExpiry = parseInt(req.query.expiry || '3600', 10);
    const expiry = Math.min(Math.max(rawExpiry, 60), 86400); // clamp 1 min – 24 hrs

    const url = await minioService.getPresignedUrl(meta.bucket_name, meta.object_key, expiry);

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'storage.file.download_request',
      entityType: 'file_metadata',
      entityId: meta.id,
      metadata: {
        fileName: meta.original_name,
        bucketName: meta.bucket_name,
        objectKey: meta.object_key,
        expiry,
      },
      context: req.auditContext,
    });

    res.json({ success: true, url, expiresIn: expiry });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/storage/files
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

    await auditService.recordAuditEvent({
      user: req.user,
      action: 'storage.file.delete',
      entityType: 'file_metadata',
      entityId: meta.id,
      metadata: {
        fileName: meta.original_name,
        bucketName: meta.bucket_name,
        objectKey: meta.object_key,
      },
      context: req.auditContext,
    });

    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, uploadFile, getDownloadUrl, listFiles, deleteFile };
