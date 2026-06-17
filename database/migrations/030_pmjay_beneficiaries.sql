-- Migration: 030_pmjay_beneficiaries.sql
-- Phase 11.1: PM-JAY Beneficiary Eligibility Foundation
-- Note: File numbered 030 (029 was used by Phase 10.3 health_record_exchange permissions).
--
-- Architecture:
--   • One-to-one with patient (single active PM-JAY enrollment per patient per tenant)
--   • pmjay_id is the government-issued Beneficiary ID (BIS/HH ID)
--   • eligibility_status: eligible | ineligible | pending
--   • verification_status: pending | verified | failed
--   • Future-ready: metadata JSONB reserved for claim processing fields
--   • Soft unlink: row is deleted; history preserved via audit log

-- ============================================================
-- 1. pmjay_beneficiaries Table
-- ============================================================

CREATE TABLE IF NOT EXISTS pmjay_beneficiaries (
  id                   SERIAL       PRIMARY KEY,
  tenant_id            INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id           INTEGER      NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,

  -- Government-issued PM-JAY Beneficiary ID
  pmjay_id             VARCHAR(30)  NOT NULL,

  -- Name on PM-JAY card (may differ from patient registered name)
  beneficiary_name     VARCHAR(200) NOT NULL,

  -- Current eligibility status from PM-JAY registry (populated by future API)
  eligibility_status   VARCHAR(20)  NOT NULL DEFAULT 'pending'
    CHECK (eligibility_status IN ('pending', 'eligible', 'ineligible')),

  -- Internal verification step (staff confirms physical card / document)
  verification_status  VARCHAR(20)  NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'verified', 'failed')),

  verified_at   TIMESTAMPTZ,          -- set when verification_status → 'verified'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Reserved for Phase 11.2 claim processing (scheme_name, family_id, etc.)
  metadata      JSONB       NOT NULL DEFAULT '{}'::JSONB,

  -- One active PM-JAY enrollment per patient per tenant
  UNIQUE (tenant_id, patient_id),

  -- pmjay_id must be unique within a tenant (prevents the same BIS ID being linked twice)
  UNIQUE (tenant_id, pmjay_id)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_pmjay_beneficiaries()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pmjay_beneficiaries_updated_at ON pmjay_beneficiaries;
CREATE TRIGGER trg_pmjay_beneficiaries_updated_at
  BEFORE UPDATE ON pmjay_beneficiaries
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_pmjay_beneficiaries();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_pmjay_tenant_patient ON pmjay_beneficiaries(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_id             ON pmjay_beneficiaries(tenant_id, pmjay_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_eligibility    ON pmjay_beneficiaries(tenant_id, eligibility_status);

-- ============================================================
-- 2. PM-JAY Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('pmjay.read',   'Read PM-JAY Beneficiary',   'View a patient''s PM-JAY enrollment and eligibility details'),
  ('pmjay.link',   'Link PM-JAY Beneficiary',   'Enroll a patient into the PM-JAY scheme'),
  ('pmjay.verify', 'Verify PM-JAY Beneficiary', 'Mark a PM-JAY enrollment as staff-verified'),
  ('pmjay.unlink', 'Unlink PM-JAY Beneficiary', 'Remove a patient''s PM-JAY enrollment')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('pmjay.read', 'pmjay.link', 'pmjay.verify', 'pmjay.unlink')
ON CONFLICT DO NOTHING;

-- Doctor: read-only (must see whether patient is PM-JAY eligible for treatment decisions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('pmjay.read')
ON CONFLICT DO NOTHING;

-- Patient Manager: can read, link, verify — not unlink (unlink is admin-only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('pmjay.read', 'pmjay.link', 'pmjay.verify')
ON CONFLICT DO NOTHING;

-- Receptionist: read-only (needs to know eligibility at front desk)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'receptionist'
  AND p.code IN ('pmjay.read')
ON CONFLICT DO NOTHING;
