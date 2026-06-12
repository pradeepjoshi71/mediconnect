-- Migration: 018_expense_management.sql
-- Creates the expenses table and inserts/grants finance management permissions.

CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Rent', 'Electricity', 'Internet', 'Salary', 'Equipment', 'Miscellaneous')),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  description TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_hospital_date ON expenses (hospital_id, expense_date);

-- Register permission
INSERT INTO permissions (code, name, description)
VALUES ('manage_finances', 'Manage Finances', 'Ability to view revenue dashboards, manage expenses, and view profit & loss data')
ON CONFLICT (code) DO NOTHING;

-- Grant to Admin / Hospital Admin / Super Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code = 'manage_finances'
ON CONFLICT DO NOTHING;
