-- Migration: 010_audit_old_new_values.sql
-- Adds old_value and new_value JSONB columns to audit_logs
-- to capture before/after state for create, update, and delete operations.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS old_value JSONB,
  ADD COLUMN IF NOT EXISTS new_value JSONB;

-- Index to support querying change history for a specific entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity
  ON audit_logs (hospital_id, entity_type, entity_id, created_at DESC);
