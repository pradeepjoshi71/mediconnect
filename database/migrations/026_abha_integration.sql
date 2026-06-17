-- Migration: 026_abha_integration.sql
-- Phase 9.0: ABHA (Ayushman Bharat Health Account) Integration
-- Creates a dedicated side-table for optional ABHA linkage per patient per tenant.
-- Zero changes to existing patients, users, or any other table.

-- ============================================================
-- 1. ABHA Details Table
-- 0-or-1 per patient per tenant (UNIQUE constraint enforces it)
-- abha_number is stored encrypted (handled at repository layer)
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_abha_details (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id          INTEGER      NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  abha_number         VARCHAR(64)  NOT NULL,  -- encrypted at rest; raw value is 14-char digit string
  abha_address        VARCHAR(100),           -- PHR address e.g. user@abdm (optional)
  verification_status VARCHAR(20)  NOT NULL DEFAULT 'pending'
                      CHECK (verification_status IN ('pending', 'verified', 'failed', 'unlinked')),
  verified_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- One ABHA record per patient per tenant (cannot link twice)
  UNIQUE (tenant_id, patient_id),
  -- No duplicate ABHA numbers within the same tenant
  UNIQUE (tenant_id, abha_number)
);

-- Auto-update updated_at on every row change
CREATE OR REPLACE FUNCTION set_updated_at_patient_abha()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_patient_abha_updated_at ON patient_abha_details;
CREATE TRIGGER trg_patient_abha_updated_at
  BEFORE UPDATE ON patient_abha_details
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_patient_abha();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_abha_tenant_patient ON patient_abha_details(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_abha_tenant_status  ON patient_abha_details(tenant_id, verification_status);

-- ============================================================
-- 2. ABHA Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('abha.read',   'Read ABHA Details',   'View a patient''s linked ABHA number and verification status'),
  ('abha.link',   'Link ABHA',           'Associate an ABHA number with a patient profile'),
  ('abha.verify', 'Verify ABHA',         'Update the verification status of a patient''s ABHA record'),
  ('abha.unlink', 'Unlink ABHA',         'Remove the ABHA linkage from a patient profile')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin: full bypass (already granted all via migration 022).
-- Also explicitly seed here in case future migrations need a clean slate.
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('abha.read', 'abha.link', 'abha.verify', 'abha.unlink')
ON CONFLICT DO NOTHING;

-- Doctor: read-only (treating physician should see patient's ABHA identity)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('abha.read')
ON CONFLICT DO NOTHING;

-- Patient Manager: can link and verify (front-desk clinical registration role)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('abha.read', 'abha.link', 'abha.verify')
ON CONFLICT DO NOTHING;
