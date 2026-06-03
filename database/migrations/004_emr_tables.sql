-- Migration: 004_emr_tables.sql
-- Creates tables and columns for Phase 2: Patient Management and EMR

-- 1. Update medical_records table with new columns if not exists
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS symptoms TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS treatment_plan TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS prescription TEXT;
ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS follow_up_date DATE;

-- 2. Create patient_allergies table
CREATE TABLE IF NOT EXISTS patient_allergies (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  allergy_name VARCHAR(255) NOT NULL,
  severity VARCHAR(30) NOT NULL,
  notes TEXT
);

-- 3. Create patient_medications table
CREATE TABLE IF NOT EXISTS patient_medications (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  medication_name VARCHAR(255) NOT NULL,
  dosage VARCHAR(120) NOT NULL,
  frequency VARCHAR(120) NOT NULL,
  start_date DATE,
  end_date DATE
);

-- 4. Create medical_documents table
CREATE TABLE IF NOT EXISTS medical_documents (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  document_type VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Add insurance_policy_number to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_policy_number VARCHAR(80);
