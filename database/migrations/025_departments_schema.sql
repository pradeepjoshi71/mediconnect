-- Migration: Create departments and membership tables
CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  head_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);

CREATE TABLE IF NOT EXISTS department_members (
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, user_id)
);

-- Seed new functional permissions
INSERT INTO permissions (code, name, description) VALUES
  ('department.read', 'Read Departments', 'View hospital department details and statistics'),
  ('department.create', 'Create Departments', 'Establish new hospital departments'),
  ('department.update', 'Update Departments', 'Edit department details and configurations'),
  ('department.assign', 'Assign Departments', 'Assign department heads and staff memberships')
ON CONFLICT (code) DO NOTHING;

-- Map permissions to Admins, Hospital Admins, and Super Admins
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('department.read', 'department.create', 'department.update', 'department.assign')
ON CONFLICT DO NOTHING;
