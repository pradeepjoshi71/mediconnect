-- Migration: 029_health_record_exchange.sql
-- Phase 10.3: ABDM Health Record Exchange Foundation
-- Permissions only — NO new tables.
-- The exchange service is a read-only mapping layer over existing schemas.

-- ============================================================
-- 1. Health Record Exchange Permissions
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('healthrecord.read',   'Read Health Records (Exchange)', 'Fetch patient clinical data for FHIR-formatted Health Information Exchange'),
  ('healthrecord.export', 'Export Health Records (FHIR)',   'Generate and export a FHIR-formatted health record bundle for ABDM HIE')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Role → Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin: full access (read + export)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('healthrecord.read', 'healthrecord.export')
ON CONFLICT DO NOTHING;

-- Doctor: can read and export (required for ABDM HIE workflow —
--   treating physician initiates health record sharing)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN ('healthrecord.read', 'healthrecord.export')
ON CONFLICT DO NOTHING;

-- Patient Manager: read-only (can view what is exchangeable but not trigger exports)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN ('healthrecord.read')
ON CONFLICT DO NOTHING;
