-- Migration: 028_abdm_care_contexts.sql
-- Phase 10.2: ABDM Care Context Linking Foundation
-- Creates abdm_care_contexts table to track patient Health Information (HI)
-- contexts that are linked to ABDM/HIE via ABHA identity.
--
-- Architecture:
--   • One patient → many care contexts (different encounter types, departments, dates)
--   • abha_id is nullable FK to patient_abha_details — ABHA must exist to link HIE,
--     but the table can store local contexts even before ABHA is linked
--   • care_context_reference is the ABDM-assigned unique identifier per context
--   • Unique constraint: (tenant_id, care_context_reference) — no duplicate contexts in a tenant
--   • status: active | inactive | unlinked
--   • Append-safe: unlink sets status = 'unlinked'; history is never deleted

-- ============================================================
-- 1. abdm_care_contexts Table
-- ============================================================

CREATE TABLE IF NOT EXISTS abdm_care_contexts (
  id                       SERIAL       PRIMARY KEY,
  tenant_id                INTEGER      NOT NULL REFERENCES hospitals(id)           ON DELETE CASCADE,
  patient_id               INTEGER      NOT NULL REFERENCES patients(id)            ON DELETE CASCADE,
  abha_id                  INTEGER               REFERENCES patient_abha_details(id) ON DELETE SET NULL,

  -- ABDM-defined unique context reference (e.g. "DISCHARGE_2024_01_15_001")
  care_context_reference   VARCHAR(100) NOT NULL,

  -- Human-readable label shown in ABDM apps
  display_name             VARCHAR(200) NOT NULL,

  -- Lifecycle status
  status     VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'unlinked')),

  linked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- No two contexts may share the same reference in the same tenant
  UNIQUE (tenant_id, care_context_reference)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION set_updated_at_abdm_care_contexts()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_abdm_care_contexts_updated_at ON abdm_care_contexts;
CREATE TRIGGER trg_abdm_care_contexts_updated_at
  BEFORE UPDATE ON abdm_care_contexts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_abdm_care_contexts();

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_care_ctx_patient ON abdm_care_contexts(tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_care_ctx_abha    ON abdm_care_contexts(abha_id) WHERE abha_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_care_ctx_status  ON abdm_care_contexts(tenant_id, status);

-- ============================================================
-- 2. ABDM Care Context Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('abdm.carecontext.read',   'Read Care Contexts',   'View a patient''s linked ABDM care contexts'),
  ('abdm.carecontext.link',   'Link Care Context',    'Register a new care context for a patient'),
  ('abdm.carecontext.unlink', 'Unlink Care Context',  'Mark a care context as unlinked/inactive')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin: full access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('abdm.carecontext.read', 'abdm.carecontext.link', 'abdm.carecontext.unlink')
ON CONFLICT DO NOTHING;

-- Doctor: read-only (needs to see what HIE data is available for a patient)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('abdm.carecontext.read')
ON CONFLICT DO NOTHING;

-- Patient Manager: can read and link (clinical registration workflow)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('abdm.carecontext.read', 'abdm.carecontext.link', 'abdm.carecontext.unlink')
ON CONFLICT DO NOTHING;
