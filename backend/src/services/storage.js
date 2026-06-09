'use strict';

/**
 * storage.js — Cloudflare R2 secure file access service.
 *
 * Uses AWS SDK v3 (S3-compatible) pointed at the Cloudflare R2 endpoint.
 * Exports `getSecurePresignedUrl` which enforces strict per-tenant key isolation
 * before generating a 15-minute presigned GET URL.
 *
 * Required env vars:
 *   R2_ACCOUNT_ID          — Cloudflare account ID (used to build the endpoint)
 *   R2_ACCESS_KEY_ID       — R2 API token Access Key ID
 *   R2_SECRET_ACCESS_KEY   — R2 API token Secret Access Key
 *   R2_BUCKET_NAME         — Target R2 bucket name
 */

const { S3Client, GetObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { AppError } = require('../utils/http');

// ─── Presigned URL TTL ────────────────────────────────────────────────────────
const PRESIGNED_URL_TTL_SECONDS = 900; // 15 minutes — strict clinical data access window

// ─── S3Client singleton (R2 endpoint) ────────────────────────────────────────

let _r2Client = null;

function getR2Client() {
  if (_r2Client) return _r2Client;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      '[storage] Missing R2 credentials. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.'
    );
  }

  _r2Client = new S3Client({
    region: 'auto',                          // R2 does not use AWS regions; 'auto' is required
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    // R2 uses path-style addressing — virtual-hosted style is not supported
    forcePathStyle: true,
  });

  return _r2Client;
}

// ─── Tenant key validation ────────────────────────────────────────────────────

/**
 * Enforces that a file key belongs to the requesting tenant.
 *
 * All R2 objects MUST be stored under the pattern:
 *   tenant_<tenantId>/<fileCategory>/<uuid>.<ext>
 *
 * This prevents horizontal privilege escalation where a malicious actor
 * crafts a fileKey for a different tenant's path.
 *
 * @param {string} fileKey   — Object key from the request
 * @param {string|number} tenantId — Authenticated tenant (hospitalId from JWT)
 * @throws {AppError} 403 if the key does not belong to the tenant
 */
function assertTenantOwnership(fileKey, tenantId) {
  if (!fileKey || typeof fileKey !== 'string') {
    throw new AppError(400, 'Invalid file key.');
  }

  // Sanitise tenantId to prevent regex/path traversal injection
  const safeTenantId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  if (!safeTenantId) {
    throw new AppError(400, 'Invalid tenant ID.');
  }

  // Path traversal guard — reject keys containing .. segments
  if (fileKey.includes('..') || fileKey.includes('//')) {
    throw new AppError(403, 'Access denied: malformed file key.');
  }

  const expectedPrefix = `tenant_${safeTenantId}/`;

  if (!fileKey.startsWith(expectedPrefix)) {
    // Log the violation attempt for audit — do not reveal the correct prefix
    console.warn(
      `[storage] Tenant isolation violation: tenantId="${safeTenantId}" attempted access to key="${fileKey}"`
    );
    throw new AppError(403, 'Access denied: file does not belong to your organisation.');
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates a short-lived presigned GET URL for a private R2 object,
 * after verifying that the file key belongs to the requesting tenant.
 *
 * @param {string}        fileKey   — R2 object key, e.g. "tenant_42/lab-reports/abc.pdf"
 * @param {string|number} tenantId  — Caller's hospitalId (from req.user.hospitalId)
 * @returns {Promise<string>}       — Presigned GET URL valid for 15 minutes
 * @throws {AppError} 400/403 on invalid input or tenant mismatch
 * @throws {AppError} 404 if the object does not exist in R2
 */
async function getSecurePresignedUrl(fileKey, tenantId) {
  // ── 1. Enforce multi-tenant isolation FIRST — before any AWS call ──────────
  assertTenantOwnership(fileKey, tenantId);

  const client   = getR2Client();
  const bucket   = process.env.R2_BUCKET_NAME;

  if (!bucket) {
    throw new Error('[storage] R2_BUCKET_NAME environment variable is not set.');
  }

  // ── 2. Verify the object actually exists (prevents presigning ghost keys) ──
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: fileKey }));
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      throw new AppError(404, 'File not found.');
    }
    // Re-throw unexpected R2 errors (credentials, network, etc.)
    throw err;
  }

  // ── 3. Generate presigned GET URL — 15-minute hard expiry ─────────────────
  const command = new GetObjectCommand({ Bucket: bucket, Key: fileKey });

  const presignedUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_TTL_SECONDS,
  });

  return presignedUrl;
}

/**
 * Constructs the canonical R2 object key for a new upload.
 * Use this when storing files to guarantee the correct tenant prefix.
 *
 * @param {string|number} tenantId
 * @param {string}        category  — e.g. 'lab-reports', 'prescriptions'
 * @param {string}        fileName  — UUID-based filename with extension
 * @returns {string}
 */
function buildTenantKey(tenantId, category, fileName) {
  const safeTenantId = String(tenantId).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeCategory = category.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
  return `tenant_${safeTenantId}/${safeCategory}/${safeFileName}`;
}

module.exports = {
  getSecurePresignedUrl,
  buildTenantKey,
};
