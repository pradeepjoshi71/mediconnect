-- Migration: 032_pmjay_analytics_permissions.sql
-- Phase 11.3: PM-JAY Dashboard & Analytics Permissions
--

-- ============================================================
-- 1. Seed Permission
-- ============================================================

INSERT INTO permissions (code, name, description) VALUES
  ('pmjay.analytics.read', 'Read PM-JAY Analytics', 'View PM-JAY dashboard statistics, claim analytics, and reports')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 2. Role -> Permission Mapping
-- ============================================================

-- Super Admin, Hospital Admin, Admin, Billing Admin: read-only analytics access
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin', 'billing_admin')
  AND p.code = 'pmjay.analytics.read'
ON CONFLICT DO NOTHING;
