-- Migration: 009_production_readiness.sql
-- Phase 6: Production Readiness Layer
-- Adds: departments, file_metadata, device_tokens, pharmacist role, FireBase notification channel, MinIO support

-- ============================================================
-- MULTI-HOSPITAL SUPPORT: Departments table
-- hospitals table already exists in init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  department_code VARCHAR(30)  NOT NULL,
  department_name VARCHAR(255) NOT NULL,
  description     TEXT,
  head_doctor_id  INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, department_code)
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed departments for existing hospitals
INSERT INTO departments (hospital_id, department_code, department_name, description)
SELECT h.id, dep.code, dep.name, dep.descr
FROM hospitals h
CROSS JOIN (
  VALUES
    ('CARDIOLOGY',  'Cardiology',       'Cardiac Sciences and Heart Disease'),
    ('GENERAL',     'General Medicine', 'General Outpatient and Internal Medicine'),
    ('RADIOLOGY',   'Radiology',        'Imaging and Diagnostic Radiology'),
    ('PHARMACY',    'Pharmacy',         'Medications and Drug Dispensing'),
    ('LABORATORY',  'Laboratory',       'Lab Tests and Diagnostics')
) AS dep(code, name, descr)
ON CONFLICT (hospital_id, department_code) DO NOTHING;

-- Add department_id to users (optional FK for staff assignment)
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================================
-- PHARMACIST ROLE + PERMISSIONS
-- ============================================================

INSERT INTO roles (code, name, description)
VALUES ('pharmacist', 'Pharmacist', 'Pharmacy, medicine inventory and dispensing access')
ON CONFLICT (code) DO NOTHING;

INSERT INTO permissions (code, name, description)
VALUES
  ('manage_medicines',  'Manage Medicines',  'Add, edit and update medicine inventory'),
  ('view_prescriptions','View Prescriptions', 'View patient prescriptions'),
  ('dispense_medicines','Dispense Medicines', 'Record medication dispensing to patients'),
  ('manage_inventory',  'Manage Inventory',  'Monitor stock levels and expiry alerts')
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.code = 'pharmacist'
  AND p.code IN ('manage_medicines','view_prescriptions','dispense_medicines','manage_inventory')
ON CONFLICT DO NOTHING;

-- ============================================================
-- MINIO OBJECT STORAGE: file_metadata table
-- Tracks objects stored in MinIO; existing `files` table tracks
-- local disk uploads. file_metadata is for MinIO-backed objects.
-- ============================================================

CREATE TABLE IF NOT EXISTS file_metadata (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  uploaded_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  bucket_name     VARCHAR(100) NOT NULL,
  object_key      TEXT         NOT NULL UNIQUE,
  original_name   VARCHAR(500) NOT NULL,
  mime_type       VARCHAR(200),
  file_size       BIGINT,
  resource_type   VARCHAR(100),
  resource_id     INTEGER,
  is_public       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_file_metadata_hospital   ON file_metadata(hospital_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_resource   ON file_metadata(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_file_metadata_uploaded   ON file_metadata(uploaded_by);

-- ============================================================
-- FIREBASE PUSH NOTIFICATIONS: device_tokens table
-- ============================================================

CREATE TABLE IF NOT EXISTS device_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hospital_id INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  fcm_token   TEXT         NOT NULL,
  platform    VARCHAR(20)  NOT NULL DEFAULT 'web'
    CHECK (platform IN ('web', 'android', 'ios')),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (user_id, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id, is_active);

CREATE TRIGGER trg_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add firebase channel to notifications check constraint (extend via new check)
-- The existing notifications table supports channel IN ('in_app','email','sms','whatsapp','system')
-- We add 'push' channel via a new alter. Use DO block to handle if already added.
DO $$
BEGIN
  -- Drop old constraint and add updated one that includes 'push'
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_channel_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_channel_check
    CHECK (channel IN ('in_app','email','sms','whatsapp','system','push'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- ignore if constraint update fails
END $$;
