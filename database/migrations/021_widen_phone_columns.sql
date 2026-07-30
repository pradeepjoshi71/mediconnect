-- Migration 021: Widen phone columns to accommodate encrypted base64 strings.
-- AES-256-GCM ciphertexts with IV and auth tags are typically > 58 characters.

ALTER TABLE users 
  ALTER COLUMN phone TYPE VARCHAR(255);

ALTER TABLE patients 
  ALTER COLUMN emergency_contact_phone TYPE VARCHAR(255);

ALTER TABLE hospitals 
  ALTER COLUMN support_phone TYPE VARCHAR(255);
