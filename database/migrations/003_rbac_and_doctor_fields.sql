-- Migration: 003_rbac_and_doctor_fields.sql
-- Adds RBAC tables and updates doctors table with qualification field

-- 1. Create permissions table
CREATE TABLE IF NOT EXISTS permissions (
  id SERIAL PRIMARY KEY,
  code VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create role_permissions table
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 3. Create user_roles table
CREATE TABLE IF NOT EXISTS user_roles (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- 4. Add qualification column to doctors table
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS qualification VARCHAR(255) NOT NULL DEFAULT 'MD';

-- 5. Seed new roles if they don't exist
INSERT INTO roles (code, name, description)
VALUES 
  ('super_admin', 'Super Admin', 'Full system-wide administrative access'),
  ('hospital_admin', 'Hospital Admin', 'Hospital-level administrative access')
ON CONFLICT (code) DO NOTHING;

-- 6. Seed permissions
INSERT INTO permissions (code, name, description)
VALUES
  ('manage_doctors', 'Manage Doctors', 'Ability to create, edit, and toggle status of doctors'),
  ('view_dashboard', 'View Dashboard', 'Ability to view the hospital administration dashboard')
ON CONFLICT (code) DO NOTHING;

-- 7. Map permissions to roles
-- Super Admin, Hospital Admin, and legacy Admin roles get both permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('manage_doctors', 'view_dashboard')
ON CONFLICT DO NOTHING;

-- 8. Populate user_roles table with existing user roles
INSERT INTO user_roles (user_id, role_id)
SELECT id, role_id FROM users
ON CONFLICT DO NOTHING;
