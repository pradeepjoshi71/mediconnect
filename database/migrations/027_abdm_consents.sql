-- Migration: 027_abdm_consents.sql
-- Phase 10.1: ABDM Consent Management Foundation
-- Creates abdm_consents table for tracking patient data-sharing consent records.
--
-- Design decisions:
--   • Separate table (not a column on patients) — consent is an independent,
--     auditable domain object with its own lifecycle and expiry.
--   • Multiple rows per patient allowed — each grant/revoke creates a new record,
--     giving a complete consent history (essential for ABDM compliance).
--   • Soft expiry: expires_at stored; callers filter on it. No background job needed.
--   • Indexed on (tenant_id, patient_id, status) for common dashboard queries.

-- ============================================================
-- 1. abdm_consents Table
-- ============================================================

CREATE TABLE IF NOT EXISTS abdm_consents (
  id           SERIAL       PRIMARY KEY,
  tenant_id    INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id   INTEGER      NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,

  -- Type of consent being recorded
  consent_type VARCHAR(40)  NOT NULL
    CHECK (consent_type IN (
      'data_access',       -- General EMR data access
      'health_record_share', -- Share records with another provider
      'telemedicine',      -- Consent for video consultation
      'research',          -- Anonymised research use
      'emergency_access',  -- Emergency break-glass access
      'general'            -- Blanket ABDM digital consent
    )),

  -- Lifecycle status
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'granted', 'revoked', 'expired')),

  -- Timestamps
  granted_at   TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,          -- NULL = no expiry
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- Optional: free-form metadata (requester system, purpose text, etc.)
  -- Kept nullable to remain non-breaking in Phase 1; Phase 2 can populate
  metadata     JSONB        DEFAULT '{}'::JSONB
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_abdm_consents()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_abdm_consents_updated_at ON abdm_consents;
CREATE TRIGGER trg_abdm_consents_updated_at
  BEFORE UPDATE ON abdm_consents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_abdm_consents();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_abdm_consents_patient  ON abdm_consents(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_abdm_consents_status   ON abdm_consents(tenant_id, patient_id, status);
CREATE INDEX IF NOT EXISTS idx_abdm_consents_type     ON abdm_consents(tenant_id, consent_type, status);
CREATE INDEX IF NOT EXISTS idx_abdm_consents_expires  ON abdm_consents(expires_at) WHERE expires_at IS NOT NULL;

-- ============================================================
-- 2. ABDM Consent Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('abdm.consent.read',   'Read ABDM Consents',   'View patient consent records and history'),
  ('abdm.consent.grant',  'Grant ABDM Consent',   'Record a new patient consent grant'),
  ('abdm.consent.revoke', 'Revoke ABDM Consent',  'Revoke an active patient consent')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin: full access (bypass also covers them)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('abdm.consent.read', 'abdm.consent.grant', 'abdm.consent.revoke')
ON CONFLICT DO NOTHING;

-- Doctor: read-only (treating physician must be able to view consent status)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('abdm.consent.read')
ON CONFLICT DO NOTHING;

-- Patient Manager: can read, grant, and revoke (clinical registration role)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('abdm.consent.read', 'abdm.consent.grant', 'abdm.consent.revoke')
ON CONFLICT DO NOTHING;
