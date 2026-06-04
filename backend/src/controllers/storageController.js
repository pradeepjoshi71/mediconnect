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

const BUCKET_MAP = {
  lab_report:      'lab-reports',
  prescription:    'prescriptions',
  invoice:         'invoices',
  patient_document:'patient-documents',
  profile_image:   'profile-images',
};

async function uploadFile(req, res, next) {
  try {
    const { resourceType, resourceId } = req.body;
    const bucket = BUCKET_MAP[resourceType] || 'patient-documents';
    const file = req.file;
    if (!file) throw new AppError(400, 'No file uploaded');

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
      hospitalId: req.user.hospitalId,
      uploadedBy: req.user.id,
      bucketName: bucket,
      objectKey,
      originalName: file.originalname,
      mimeType: file.mimetype,
      fileSize: file.size,
      resourceType: resourceType || null,
      resourceId: resourceId ? parseInt(resourceId, 10) : null,
      isPublic: false,
    });

    res.status(201).json({ success: true, file: meta });
  } catch (err) {
    next(err);
  }
}

async function getDownloadUrl(req, res, next) {
  try {
    const meta = await fileMetadataRepo.getFileMetadata(req.params.id);
    if (!meta) throw new AppError(404, 'File not found');

    // Ensure same hospital
    if (meta.hospital_id !== req.user.hospitalId) throw new AppError(403, 'Forbidden');

    const url = await minioService.getPresignedUrl(meta.bucket_name, meta.object_key, 3600);
    res.json({ success: true, url, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
}

async function listFiles(req, res, next) {
  try {
    const { resourceType, resourceId } = req.query;
    const files = await fileMetadataRepo.listFileMetadata({
      hospitalId: req.user.hospitalId,
      resourceType: resourceType || null,
      resourceId: resourceId ? parseInt(resourceId, 10) : null,
    });
    res.json({ success: true, files });
  } catch (err) {
    next(err);
  }
}

async function deleteFile(req, res, next) {
  try {
    const meta = await fileMetadataRepo.getFileMetadata(req.params.id);
    if (!meta) throw new AppError(404, 'File not found');
    if (meta.hospital_id !== req.user.hospitalId) throw new AppError(403, 'Forbidden');

    await minioService.deleteObject(meta.bucket_name, meta.object_key);
    await fileMetadataRepo.deleteFileMetadata(req.params.id);
    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = { upload, uploadFile, getDownloadUrl, listFiles, deleteFile };
