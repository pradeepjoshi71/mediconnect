const Minio = require('minio');
const logger = require('../utils/logger');

let minioClient = null;

function getMinioClient() {
  if (minioClient) return minioClient;

  const endPoint = process.env.MINIO_ENDPOINT || 'localhost';
  const port = parseInt(process.env.MINIO_PORT || '9000', 10);
  const useSSL = process.env.MINIO_USE_SSL === 'true';
  const accessKey = process.env.MINIO_ACCESS_KEY;
  const secretKey = process.env.MINIO_SECRET_KEY;

  if (!accessKey || !secretKey) {
    logger.warn('MinIO credentials not configured – storage service disabled');
    return null;
  }

  minioClient = new Minio.Client({
    endPoint,
    port,
    useSSL,
    accessKey,
    secretKey,
  });

  return minioClient;
}

/**
 * All buckets provisioned by this service.
 * Each maps to a logical resource type stored in file_metadata.resource_type.
 *
 *   lab-reports       → lab_report
 *   prescriptions     → prescription
 *   invoices          → invoice
 *   patient-documents → patient_document
 *   profile-images    → profile_image
 *   hospital-logos    → hospital_logo
 *   doctor-documents  → doctor_document
 */
const DEFAULT_BUCKETS = [
  'lab-reports',
  'prescriptions',
  'invoices',
  'patient-documents',
  'profile-images',
  'hospital-logos',
  'doctor-documents',
];

/**
 * Ensure all required buckets exist in MinIO.
 * Called once at application startup.
 * Failures are logged but do not prevent the app from booting.
 */
async function ensureBuckets() {
  const client = getMinioClient();
  if (!client) {
    logger.warn('MinIO: skipping bucket provisioning – client not configured');
    return;
  }

  const region = process.env.MINIO_REGION || 'us-east-1';

  for (const bucket of DEFAULT_BUCKETS) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket, region);
        logger.info(`MinIO: created bucket "${bucket}"`);
      }
    } catch (err) {
      logger.error(`MinIO: failed to ensure bucket "${bucket}"`, { error: err.message });
    }
  }
  logger.info('MinIO: bucket provisioning complete');
}

/**
 * Upload a readable stream or Buffer to MinIO.
 * @param {object} opts
 * @param {string}         opts.bucket     — Target bucket name
 * @param {string}         opts.objectKey  — Unique path inside the bucket
 * @param {Readable}       opts.stream     — Readable stream of file data
 * @param {number}         opts.size       — Byte length of the data
 * @param {string}         opts.mimeType   — MIME type, e.g. "application/pdf"
 * @returns {string} The objectKey that was stored
 */
async function uploadObject({ bucket, objectKey, stream, size, mimeType }) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');

  const metaHeaders = { 'Content-Type': mimeType || 'application/octet-stream' };
  await client.putObject(bucket, objectKey, stream, size, metaHeaders);
  return objectKey;
}

/**
 * Generate a pre-signed GET URL for a private object.
 * @param {string} bucket
 * @param {string} objectKey
 * @param {number} expirySeconds — default 1 hour; max 7 days (604800)
 * @returns {Promise<string>} Signed URL
 */
async function getPresignedUrl(bucket, objectKey, expirySeconds = 3600) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');
  return client.presignedGetObject(bucket, objectKey, expirySeconds);
}

/**
 * Generate a pre-signed PUT URL so a client can upload directly to MinIO.
 * @param {string} bucket
 * @param {string} objectKey
 * @param {number} expirySeconds — default 15 minutes
 * @returns {Promise<string>} Signed PUT URL
 */
async function getPresignedPutUrl(bucket, objectKey, expirySeconds = 900) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');
  return client.presignedPutObject(bucket, objectKey, expirySeconds);
}

/**
 * Remove an object from MinIO.
 * @param {string} bucket
 * @param {string} objectKey
 */
async function deleteObject(bucket, objectKey) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');
  await client.removeObject(bucket, objectKey);
}

/**
 * Check whether MinIO is reachable and the credentials are valid.
 * Returns true if the first bucket probe succeeds, false otherwise.
 */
async function healthCheck() {
  try {
    const client = getMinioClient();
    if (!client) return false;
    await client.bucketExists(DEFAULT_BUCKETS[0]);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  getMinioClient,
  ensureBuckets,
  uploadObject,
  getPresignedUrl,
  getPresignedPutUrl,
  deleteObject,
  healthCheck,
  DEFAULT_BUCKETS,
};
