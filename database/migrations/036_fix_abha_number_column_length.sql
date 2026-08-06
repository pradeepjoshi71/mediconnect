-- Migration: 036_fix_abha_number_column_length.sql
-- Fixes ABHA ciphertext truncation bug by altering abha_number column type from VARCHAR(64) to TEXT.
-- AES-256-GCM encryption at rest produces ~86-character strings (iv:authTag:ciphertext), which exceeds 64 chars.

ALTER TABLE patient_abha_details ALTER COLUMN abha_number TYPE TEXT;
