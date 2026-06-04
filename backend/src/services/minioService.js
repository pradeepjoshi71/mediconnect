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

const DEFAULT_BUCKETS = ['lab-reports', 'prescriptions', 'invoices', 'patient-documents', 'profile-images'];

async function ensureBuckets() {
  const client = getMinioClient();
  if (!client) return;

  for (const bucket of DEFAULT_BUCKETS) {
    try {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket, process.env.MINIO_REGION || 'us-east-1');
        logger.info(`MinIO: created bucket "${bucket}"`);
      }
    } catch (err) {
      logger.error(`MinIO: failed to ensure bucket "${bucket}"`, { error: err.message });
    }
  }
}

/**
 * Upload a file buffer/stream to MinIO.
 * Returns the object key.
 */
async function uploadObject({ bucket, objectKey, stream, size, mimeType }) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');

  const metadata = { 'Content-Type': mimeType || 'application/octet-stream' };
  await client.putObject(bucket, objectKey, stream, size, metadata);
  return objectKey;
}

/**
 * Get a pre-signed download URL valid for `expirySeconds` (default 1 hour).
 */
async function getPresignedUrl(bucket, objectKey, expirySeconds = 3600) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');
  return client.presignedGetObject(bucket, objectKey, expirySeconds);
}

/**
 * Delete an object from MinIO.
 */
async function deleteObject(bucket, objectKey) {
  const client = getMinioClient();
  if (!client) throw new Error('MinIO not configured');
  await client.removeObject(bucket, objectKey);
}

module.exports = { getMinioClient, ensureBuckets, uploadObject, getPresignedUrl, deleteObject, DEFAULT_BUCKETS };
