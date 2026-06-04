-- Migration: 007_lab_management.sql
-- Creates lab_tests, lab_orders, and lab_reports tables and seeds the lab_technician role

-- 1. Insert lab_technician role
INSERT INTO roles (code, name, description)
VALUES ('lab_technician', 'Lab Technician', 'Lab management and diagnostic reports access')
ON CONFLICT (code) DO NOTHING;

-- 2. Create lab_tests table
CREATE TABLE IF NOT EXISTS lab_tests (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  test_code VARCHAR(50) NOT NULL,
  test_name VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  price DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, test_code)
);

-- 3. Create lab_orders table
CREATE TABLE IF NOT EXISTS lab_orders (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  test_id INTEGER NOT NULL REFERENCES lab_tests(id) ON DELETE CASCADE,
  order_status VARCHAR(30) NOT NULL DEFAULT 'ORDERED' 
    CHECK (order_status IN ('ORDERED', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'CANCELLED')),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create lab_reports table
CREATE TABLE IF NOT EXISTS lab_reports (
  id SERIAL PRIMARY KEY,
  hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  lab_order_id INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  report_file_url VARCHAR(255) NOT NULL,
  report_notes TEXT,
  uploaded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Seed some basic lab tests for the default hospital MCH-BLR
INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
SELECT 
  id, 'CBC', 'Complete Blood Count', 'Hematology', 350.00, 'Routine blood test to evaluate overall health', 'active'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
SELECT 
  id, 'LFT', 'Liver Function Test', 'Biochemistry', 650.00, 'Evaluates liver health and enzyme levels', 'active'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
SELECT 
  id, 'KFT', 'Kidney Function Test', 'Biochemistry', 600.00, 'Evaluates renal health and urea/creatinine levels', 'active'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
SELECT 
  id, 'TSH', 'Thyroid Stimulating Hormone', 'Endocrinology', 450.00, 'Measures thyroid hormone levels', 'active'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

INSERT INTO lab_tests (hospital_id, test_code, test_name, category, price, description, status)
SELECT 
  id, 'XRAY_CHEST', 'Chest X-Ray', 'Radiology', 500.00, 'Imaging of chest, lungs, and heart', 'active'
FROM hospitals WHERE code = 'MCH-BLR'
ON CONFLICT DO NOTHING;

-- 6. Add triggers for updated_at on lab_tests and lab_orders
CREATE TRIGGER trg_lab_tests_updated_at
  BEFORE UPDATE ON lab_tests
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_lab_orders_updated_at
  BEFORE UPDATE ON lab_orders
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
