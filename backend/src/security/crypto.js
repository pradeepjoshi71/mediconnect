'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV — GCM standard
const TAG_LENGTH = 16;  // 128-bit auth tag

/**
 * Derives a 32-byte key from the env variable.
 * Accepts either a 64-char hex string or any UTF-8 passphrase (hashed to 32 bytes).
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY environment variable is not set.');

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex'); // exact 32-byte hex key
  }

  // Fallback: SHA-256 hash of the passphrase → 32 bytes
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * @param {string} text - Plaintext to encrypt (e.g. Aadhaar number, medical notes).
 * @returns {string} - Colon-separated hex string: `iv:authTag:ciphertext`
 */
function encryptData(text) {
  if (text === null || text === undefined) return text;

  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(String(text), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext  (all hex-encoded)
  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(':');
}

/**
 * Decrypts a ciphertext string produced by `encryptData`.
 * @param {string} cipherText - Colon-separated hex string: `iv:authTag:ciphertext`
 * @returns {string} - Original plaintext
 */
function decryptData(cipherText) {
  if (cipherText === null || cipherText === undefined) return cipherText;

  const parts = String(cipherText).split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format.');

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getKey();

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encryptedData = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(), // throws if auth tag mismatch (tamper detection)
  ]);

  return decrypted.toString('utf8');
}

module.exports = { encryptData, decryptData };
