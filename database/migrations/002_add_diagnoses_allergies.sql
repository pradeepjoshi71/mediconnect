-- Migration: 002_add_diagnoses_allergies.sql
-- Adds diagnoses and allergies tables for Electronic Medical Records

-- ─── diagnoses ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnoses (
  id                BIGSERIAL PRIMARY KEY,
  hospital_id       BIGINT       NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  medical_record_id BIGINT       NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  patient_id        BIGINT       NOT NULL REFERENCES patients(id)  ON DELETE CASCADE,
  doctor_id         BIGINT       NOT NULL REFERENCES doctors(id)   ON DELETE CASCADE,
  icd_code          VARCHAR(20),
  description       TEXT         NOT NULL,
  severity          VARCHAR(30)  NOT NULL DEFAULT 'moderate'
                      CHECK (severity IN ('mild','moderate','severe','critical')),
  status            VARCHAR(30)  NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','resolved','chronic','monitoring')),
  notes             TEXT,
  onset_date        DATE,
  resolved_date     DATE,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS diagnoses_hospital_patient_idx
  ON diagnoses (hospital_id, patient_id);

CREATE INDEX IF NOT EXISTS diagnoses_medical_record_idx
  ON diagnoses (medical_record_id);

-- ─── allergies ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS allergies (
  id              BIGSERIAL PRIMARY KEY,
  hospital_id     BIGINT      NOT NULL REFERENCES hospitals(id)  ON DELETE CASCADE,
  patient_id      BIGINT      NOT NULL REFERENCES patients(id)   ON DELETE CASCADE,
  allergen        VARCHAR(200) NOT NULL,
  allergy_type    VARCHAR(50)  NOT NULL DEFAULT 'drug'
                    CHECK (allergy_type IN ('drug','food','environmental','contact','other')),
  reaction        TEXT,
  severity        VARCHAR(30)  NOT NULL DEFAULT 'moderate'
                    CHECK (severity IN ('mild','moderate','severe','anaphylactic')),
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','inactive','resolved')),
  onset_date      DATE,
  notes           TEXT,
  created_by_user_id BIGINT   REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS allergies_hospital_patient_idx
  ON allergies (hospital_id, patient_id);
