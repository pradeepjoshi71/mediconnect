-- MediConnect database bootstrap (dev only)
-- NOTE: This init script is executed on first Postgres container init.

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS doctor_time_off;
DROP TABLE IF EXISTS doctor_availability_rules;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS appointments;
DROP TABLE IF EXISTS doctors;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'doctor', 'admin')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  specialization VARCHAR(120) NOT NULL,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  bio TEXT
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointment_time_order CHECK (ends_at > starts_at),
  CONSTRAINT doctor_no_double_booking UNIQUE (doctor_id, starts_at)
);

CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_starts_at ON appointments(starts_at);

CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(40) NOT NULL,
  title VARCHAR(120) NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(user_id, read_at);

-- Doctor availability (weekly rules + time off)
CREATE TABLE doctor_availability_rules (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 20, 30, 45, 60)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT availability_time_order CHECK (end_time > start_time)
);

CREATE INDEX idx_availability_doctor ON doctor_availability_rules(doctor_id);
CREATE INDEX idx_availability_weekday ON doctor_availability_rules(doctor_id, weekday);

CREATE TABLE doctor_time_off (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT time_off_order CHECK (ends_at > starts_at)
);

CREATE INDEX idx_time_off_doctor ON doctor_time_off(doctor_id, starts_at);

-- Reports (file uploads)
CREATE TABLE reports (
  id SERIAL PRIMARY KEY,
  uploader_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  storage_name TEXT NOT NULL,
  mime_type VARCHAR(120) NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reports_patient ON reports(patient_id, created_at DESC);
CREATE INDEX idx_reports_doctor ON reports(doctor_id, created_at DESC);
CREATE INDEX idx_reports_appt ON reports(appointment_id);

-- Payments (placeholder integration)
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('stripe','razorpay')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'created' CHECK (status IN ('created','processing','paid','failed','cancelled')),
  external_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_patient ON payments(patient_id, created_at DESC);
CREATE INDEX idx_payments_appt ON payments(appointment_id);

-- Seed: a few doctors (passwords are set via app flows; these are profile shells)
-- You can create corresponding doctor users via the Admin UI/API later.
