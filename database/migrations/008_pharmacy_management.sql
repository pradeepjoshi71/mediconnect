-- Migration: 008_pharmacy_management.sql
-- Creates medicines and dispensed_medications tables, seeds the pharmacist role/permissions, maps them, and seeds default medicines/pharmacist user.

-- 1. Insert pharmacist role
INSERT INTO roles (code, name, description)
VALUES ('pharmacist', 'Pharmacist', 'Pharmacy management and medicine dispensing access')
ON CONFLICT (code) DO NOTHING;

-- 2. Create medicines table
CREATE TABLE IF NOT EXISTS medicines (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  medicine_code VARCHAR(50) NOT NULL,
  medicine_name VARCHAR(255) NOT NULL,
  generic_name VARCHAR(255),
  manufacturer VARCHAR(255),
  batch_number VARCHAR(50),
  expiry_date DATE NOT NULL,
  unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 0 CHECK (reorder_level >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, medicine_code)
);

-- 3. Create dispensed_medications table
CREATE TABLE IF NOT EXISTS dispensed_medications (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  prescription_id INTEGER REFERENCES prescriptions(id) ON DELETE SET NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  pharmacist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  dispensed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create trigger to update updated_at on medicines
CREATE OR REPLACE TRIGGER trg_medicines_updated_at
  BEFORE UPDATE ON medicines
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- 5. Seed permissions for Pharmacy Management
INSERT INTO permissions (code, name, description)
VALUES
  ('manage_medicines', 'Manage Medicines', 'Ability to create, update, and manage medicines catalog'),
  ('view_prescriptions', 'View Prescriptions', 'Ability to view patient prescriptions'),
  ('dispense_medicines', 'Dispense Medicines', 'Ability to dispense prescribed medicines'),
  ('manage_inventory', 'Manage Inventory', 'Ability to view and update stock levels')
ON CONFLICT (code) DO NOTHING;

-- 6. Map permissions to roles
-- Pharmacist gets all pharmacy permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code = 'pharmacist'
  AND p.code IN ('manage_medicines', 'view_prescriptions', 'dispense_medicines', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- Admins also get all pharmacy permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.code IN ('super_admin', 'hospital_admin', 'admin')
  AND p.code IN ('manage_medicines', 'view_prescriptions', 'dispense_medicines', 'manage_inventory')
ON CONFLICT DO NOTHING;

-- 7. Seed default medicines for default hospital (MCH-BLR)
INSERT INTO medicines (hospital_id, medicine_code, medicine_name, generic_name, manufacturer, batch_number, expiry_date, unit_price, stock_quantity, reorder_level, status)
SELECT 
  id, 'ASP-75', 'Aspirin 75mg', 'Acetylsalicylic Acid', 'Bayer', 'ASP9988', CURRENT_DATE + INTERVAL '365 days', 1.50, 50, 10, 'ACTIVE'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO medicines (hospital_id, medicine_code, medicine_name, generic_name, manufacturer, batch_number, expiry_date, unit_price, stock_quantity, reorder_level, status)
SELECT 
  id, 'ATV-20', 'Atorvastatin 20mg', 'Atorvastatin Calcium', 'Pfizer', 'ATV1122', CURRENT_DATE + INTERVAL '240 days', 3.00, 40, 5, 'ACTIVE'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO medicines (hospital_id, medicine_code, medicine_name, generic_name, manufacturer, batch_number, expiry_date, unit_price, stock_quantity, reorder_level, status)
SELECT 
  id, 'PAR-650', 'Paracetamol 650mg', 'Paracetamol', 'GSK', 'PAR4433', CURRENT_DATE + INTERVAL '500 days', 0.50, 100, 20, 'ACTIVE'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

-- 8. Seed default pharmacist user
INSERT INTO users (hospital_id, role_id, full_name, email, password_hash, phone, status)
SELECT
  h.id,
  r.id,
  'Philip Pharmacist',
  'pharmacist@mediconnect.local',
  '$2b$12$jYg8gU.be0hFGlM5f3iC9.yj7rI4Tkr96uD8cGMdLW0RaZ/tnTR7S',
  '+91-9000000005',
  'active'
FROM hospitals h, roles r
WHERE h.code = 'MCH-BLR' AND r.code = 'pharmacist'
  AND NOT EXISTS (
    SELECT 1 FROM users u2 WHERE u2.email = 'pharmacist@mediconnect.local'
  );

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, u.role_id
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE u.email = 'pharmacist@mediconnect.local'
ON CONFLICT DO NOTHING;
