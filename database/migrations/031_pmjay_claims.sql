-- Migration: 031_pmjay_claims.sql
-- Phase 11.2: PM-JAY Claim Management Foundation
-- Note: File numbered 031 (030 was used by Phase 11.1 pmjay_beneficiaries).
--
-- Architecture:
--   • One patient → many claims (one-to-many)
--   • Optional appointment_id and invoice_id references (flexible claim sourcing)
--   • beneficiary_id FK to pmjay_beneficiaries (patient must be enrolled to file a claim)
--   • claim_number is auto-generated server-side (PMJAY-YYYYMMDD-NNNNN format)
--   • Status machine: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → PAID
--   • Duplicate prevention: one DRAFT or active claim per (tenant, patient, appointment)
--   • metadata JSONB reserved for treatment codes, procedure details (Phase 11.3+)

-- ============================================================
-- 1. pmjay_claims Table
-- ============================================================

CREATE TABLE IF NOT EXISTS pmjay_claims (
  id                  SERIAL        PRIMARY KEY,
  tenant_id           INTEGER       NOT NULL REFERENCES hospitals(id)           ON DELETE CASCADE,
  patient_id          INTEGER       NOT NULL REFERENCES patients(id)            ON DELETE CASCADE,
  beneficiary_id      INTEGER       NOT NULL REFERENCES pmjay_beneficiaries(id) ON DELETE RESTRICT,

  -- Optional links to existing clinical data
  appointment_id      INTEGER       REFERENCES appointments(id) ON DELETE SET NULL,
  invoice_id          INTEGER       REFERENCES invoices(id)     ON DELETE SET NULL,

  -- Claim identification
  claim_number        VARCHAR(30)   NOT NULL,

  -- Financial
  claim_amount        NUMERIC(12,2) NOT NULL CHECK (claim_amount >= 0),

  -- Claim lifecycle status
  status              VARCHAR(20)   NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','PAID')),

  -- Lifecycle timestamps (set as status progresses)
  submitted_at        TIMESTAMPTZ,
  approved_at         TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,

  -- Rejection details (populated when status → REJECTED)
  rejection_reason    TEXT,

  -- Reserved for treatment codes, ICD-10, procedure details (Phase 11.3+)
  metadata            JSONB         NOT NULL DEFAULT '{}'::JSONB,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- claim_number must be globally unique within a tenant
  UNIQUE (tenant_id, claim_number)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_pmjay_claims()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pmjay_claims_updated_at ON pmjay_claims;
CREATE TRIGGER trg_pmjay_claims_updated_at
  BEFORE UPDATE ON pmjay_claims
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_pmjay_claims();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_pmjay_claims_tenant_patient ON pmjay_claims(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_claims_beneficiary    ON pmjay_claims(beneficiary_id);
CREATE INDEX IF NOT EXISTS idx_pmjay_claims_status         ON pmjay_claims(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pmjay_claims_appointment    ON pmjay_claims(tenant_id, appointment_id)
  WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pmjay_claims_invoice        ON pmjay_claims(tenant_id, invoice_id)
  WHERE invoice_id IS NOT NULL;

-- ============================================================
-- 2. PM-JAY Claim Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('pmjay.claim.read',   'Read PM-JAY Claims',          'View PM-JAY claim records for a patient'),
  ('pmjay.claim.create', 'Create PM-JAY Claim',         'Draft a new PM-JAY claim for a patient'),
  ('pmjay.claim.submit', 'Submit PM-JAY Claim',         'Submit a DRAFT claim to PM-JAY portal'),
  ('pmjay.claim.update', 'Update PM-JAY Claim Status',  'Move a claim through the approval lifecycle (UNDER_REVIEW → APPROVED/REJECTED/PAID)')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin, Billing Admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin', 'billing_admin')
  AND p.code IN ('pmjay.claim.read', 'pmjay.claim.create', 'pmjay.claim.submit', 'pmjay.claim.update')
ON CONFLICT DO NOTHING;

-- Doctor: read-only (must see claim status for treatment decisions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('pmjay.claim.read')
ON CONFLICT DO NOTHING;

-- Patient Manager: can read and create claims (not submit or update status)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('pmjay.claim.read', 'pmjay.claim.create')
ON CONFLICT DO NOTHING;
