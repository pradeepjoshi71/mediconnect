-- Migration: 022_enterprise_rbac_expansion.sql
-- Seeds new enterprise hospital roles, functional permissions, and establishes the role-permission mapping.

-- 1. Insert new target roles
INSERT INTO roles (code, name, description) VALUES
  ('patient_manager', 'Patient Manager', 'Registers patients and coordinates medical history'),
  ('lab_admin', 'Lab Administrator', 'Manages lab orders, specimens, and diagnostic reports'),
  ('report_admin', 'Report Administrator', 'Extracts operational reports and system analytics'),
  ('billing_admin', 'Billing Administrator', 'Manages pricing plans, issues invoices, and records payments'),
  ('inventory_admin', 'Inventory Administrator', 'Tracks hospital stocks, catalog items, and expiries')
ON CONFLICT (code) DO NOTHING;

-- 2. Insert new functional permissions
INSERT INTO permissions (code, name, description) VALUES
  ('register_patients', 'Register Patients', 'Create new patient profiles'),
  ('view_patients', 'View Patients', 'Access basic demographic lists'),
  ('manage_records', 'Manage Records', 'Modify clinical notes and patient records'),
  ('view_records', 'View Records', 'View EMR documents and clinical histories'),
  ('manage_appointments', 'Manage Appointments', 'Modify doctor schedules and book slots'),
  ('view_appointments', 'View Appointments', 'Access the scheduler view'),
  ('manage_prescriptions', 'Manage Prescriptions', 'Issue drug prescriptions'),
  ('dispense_medicines', 'Dispense Medicines', 'Mark prescriptions as dispensed'),
  ('manage_lab_orders', 'Manage Lab Orders', 'Request diagnostic tests'),
  ('manage_lab_results', 'Manage Lab Results', 'Enter results and publish lab reports'),
  ('view_reports', 'View Reports', 'Generate clinical summary PDFs'),
  ('view_analytics', 'View Analytics', 'Access business dashboard metrics'),
  ('manage_billing', 'Manage Billing', 'Modify invoice pricing and issue refunds'),
  ('record_payments', 'Record Payments', 'Record payments against invoice targets'),
  ('manage_inventory', 'Manage Inventory', 'Access warehouse stock and catalogs'),
  ('manage_settings', 'Manage Settings', 'Update branding, theme, and timezones'),
  ('telemedicine', 'Telemedicine Room Access', 'Join teleconsultation video calls')
ON CONFLICT (code) DO NOTHING;

-- 3. Map permissions to Super Admin, Hospital Admin, and Admin (Full Access Bypass)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
ON CONFLICT DO NOTHING;

-- 4. Map permissions to DOCTOR
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'doctor'
  AND p.code IN (
    'view_dashboard', 'view_patients', 'manage_records', 'view_records',
    'view_appointments', 'manage_prescriptions', 'manage_lab_orders',
    'view_reports', 'telemedicine'
  )
ON CONFLICT DO NOTHING;

-- 5. Map permissions to PATIENT_MANAGER
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient_manager'
  AND p.code IN (
    'view_dashboard', 'register_patients', 'view_patients', 'view_records',
    'manage_appointments', 'view_appointments'
  )
ON CONFLICT DO NOTHING;

-- 6. Map permissions to LAB_ADMIN and legacy LAB_TECHNICIAN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('lab_admin', 'lab_technician')
  AND p.code IN (
    'view_dashboard', 'view_patients', 'manage_lab_orders', 'manage_lab_results', 'view_reports'
  )
ON CONFLICT DO NOTHING;

-- 7. Map permissions to REPORT_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'report_admin'
  AND p.code IN (
    'view_dashboard', 'view_patients', 'view_reports', 'view_analytics'
  )
ON CONFLICT DO NOTHING;

-- 8. Map permissions to BILLING_ADMIN
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'billing_admin'
  AND p.code IN (
    'view_dashboard', 'view_patients', 'view_analytics', 'manage_billing', 'record_payments'
  )
ON CONFLICT DO NOTHING;

-- 9. Map permissions to INVENTORY_ADMIN and legacy PHARMACIST
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('inventory_admin', 'pharmacist')
  AND p.code IN (
    'view_dashboard', 'view_patients', 'manage_inventory', 'dispense_medicines'
  )
ON CONFLICT DO NOTHING;

-- 10. Map permissions to RECEPTIONIST
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'receptionist'
  AND p.code IN (
    'view_dashboard', 'register_patients', 'view_patients', 'manage_appointments',
    'view_appointments', 'record_payments'
  )
ON CONFLICT DO NOTHING;

-- 11. Map permissions to PATIENT
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'patient'
  AND p.code IN (
    'view_records', 'manage_appointments', 'view_appointments', 'record_payments', 'telemedicine'
  )
ON CONFLICT DO NOTHING;
