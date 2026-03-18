-- MediConnect HMS bootstrap schema
-- This script is intended for local/dev container initialization.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS telemedicine_messages CASCADE;
DROP TABLE IF EXISTS telemedicine_sessions CASCADE;
DROP TABLE IF EXISTS appointment_waitlist CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS files CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS medical_records CASCADE;
DROP TABLE IF EXISTS doctor_time_off CASCADE;
DROP TABLE IF EXISTS doctor_availability_rules CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctors CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone VARCHAR(24),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'inactive', 'invited', 'suspended')),
  avatar_url TEXT,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  medical_record_number VARCHAR(32) NOT NULL UNIQUE,
  date_of_birth DATE,
  gender VARCHAR(20)
    CHECK (gender IN ('male', 'female', 'other', 'undisclosed')),
  blood_group VARCHAR(5),
  emergency_contact_name VARCHAR(120),
  emergency_contact_phone VARCHAR(24),
  address TEXT,
  insurance_provider VARCHAR(120),
  insurance_member_id VARCHAR(80),
  allergies TEXT,
  chronic_conditions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  specialization VARCHAR(120) NOT NULL,
  department VARCHAR(120) NOT NULL,
  license_number VARCHAR(80) NOT NULL UNIQUE,
  experience_years INTEGER NOT NULL DEFAULT 0 CHECK (experience_years >= 0),
  rating NUMERIC(2,1) NOT NULL DEFAULT 4.7 CHECK (rating >= 0 AND rating <= 5),
  consultation_fee_cents INTEGER NOT NULL DEFAULT 5000 CHECK (consultation_fee_cents >= 0),
  biography TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE appointments (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  booked_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  appointment_type VARCHAR(30) NOT NULL DEFAULT 'consultation'
    CHECK (appointment_type IN ('consultation', 'follow_up', 'lab_review', 'vaccination')),
  consultation_mode VARCHAR(20) NOT NULL DEFAULT 'in_person'
    CHECK (consultation_mode IN ('in_person', 'telemedicine')),
  reason TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
    CHECK (
      status IN (
        'scheduled',
        'confirmed',
        'checked_in',
        'in_consultation',
        'completed',
        'cancelled',
        'no_show',
        'rescheduled'
      )
    ),
  priority VARCHAR(20) NOT NULL DEFAULT 'routine'
    CHECK (priority IN ('routine', 'urgent', 'emergency')),
  queue_number INTEGER,
  waiting_list_requested BOOLEAN NOT NULL DEFAULT false,
  waitlist_rank INTEGER,
  cancellation_reason TEXT,
  rescheduled_from_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT appointments_time_order CHECK (scheduled_end > scheduled_start)
);

CREATE UNIQUE INDEX idx_appointments_doctor_start_active
  ON appointments (doctor_id, scheduled_start)
  WHERE status IN ('scheduled', 'confirmed', 'checked_in', 'in_consultation');

CREATE INDEX idx_appointments_patient ON appointments (patient_id, scheduled_start DESC);
CREATE INDEX idx_appointments_doctor ON appointments (doctor_id, scheduled_start DESC);
CREATE INDEX idx_appointments_status ON appointments (status);
CREATE INDEX idx_appointments_priority ON appointments (priority);

CREATE TABLE refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctor_availability_rules (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday >= 0 AND weekday <= 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_minutes SMALLINT NOT NULL DEFAULT 30 CHECK (slot_minutes IN (15, 20, 30, 45, 60)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doctor_availability_time_order CHECK (end_time > start_time)
);

CREATE TABLE doctor_time_off (
  id SERIAL PRIMARY KEY,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT doctor_time_off_order CHECK (ends_at > starts_at)
);

CREATE TABLE medical_records (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  encounter_type VARCHAR(40) NOT NULL DEFAULT 'outpatient',
  chief_complaint TEXT,
  diagnosis TEXT NOT NULL,
  clinical_notes TEXT,
  doctor_notes TEXT,
  vitals JSONB NOT NULL DEFAULT '{}'::jsonb,
  lab_summary TEXT,
  follow_up_in_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_medical_records_patient ON medical_records (patient_id, created_at DESC);
CREATE INDEX idx_medical_records_doctor ON medical_records (doctor_id, created_at DESC);

CREATE TABLE prescriptions (
  id SERIAL PRIMARY KEY,
  medical_record_id INTEGER NOT NULL REFERENCES medical_records(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  medication_name VARCHAR(160) NOT NULL,
  dosage VARCHAR(120) NOT NULL,
  frequency VARCHAR(120) NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1 CHECK (duration_days > 0),
  instructions TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE files (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  medical_record_id INTEGER REFERENCES medical_records(id) ON DELETE SET NULL,
  uploaded_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_category VARCHAR(30) NOT NULL DEFAULT 'other'
    CHECK (
      file_category IN (
        'lab_report',
        'radiology',
        'prescription_pdf',
        'invoice_pdf',
        'clinical_attachment',
        'other'
      )
    ),
  original_name TEXT NOT NULL,
  storage_name TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(120) NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  access_scope VARCHAR(20) NOT NULL DEFAULT 'care_team'
    CHECK (access_scope IN ('patient_only', 'care_team', 'admin_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_files_patient ON files (patient_id, created_at DESC);
CREATE INDEX idx_files_appointment ON files (appointment_id);
CREATE INDEX idx_files_record ON files (medical_record_id);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER REFERENCES appointments(id) ON DELETE SET NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  initiated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  provider VARCHAR(20) NOT NULL
    CHECK (provider IN ('stripe', 'razorpay', 'cash', 'insurance')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency VARCHAR(8) NOT NULL DEFAULT 'USD',
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded')),
  invoice_number VARCHAR(40) NOT NULL UNIQUE,
  external_reference TEXT,
  payment_method_label VARCHAR(80),
  paid_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_patient ON payments (patient_id, created_at DESC);
CREATE INDEX idx_payments_status ON payments (status);

CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app', 'email', 'sms', 'system')),
  event_type VARCHAR(80) NOT NULL,
  title VARCHAR(160) NOT NULL,
  body TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'read')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_read ON notifications (user_id, read_at);

CREATE TABLE appointment_waitlist (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  preferred_date DATE NOT NULL,
  preferred_window VARCHAR(40),
  priority VARCHAR(20) NOT NULL DEFAULT 'routine'
    CHECK (priority IN ('routine', 'urgent', 'emergency')),
  reason TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'offered', 'fulfilled', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_waitlist_doctor_date ON appointment_waitlist (doctor_id, preferred_date, status);

CREATE TABLE telemedicine_sessions (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL DEFAULT 'webrtc_placeholder',
  room_code VARCHAR(80) NOT NULL UNIQUE,
  join_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ready'
    CHECK (status IN ('ready', 'active', 'ended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE telemedicine_messages (
  id SERIAL PRIMARY KEY,
  appointment_id INTEGER NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  sender_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_medical_records_updated_at
  BEFORE UPDATE ON medical_records
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO roles (code, name, description)
VALUES
  ('admin', 'Administrator', 'Hospital operations and analytics access'),
  ('doctor', 'Doctor', 'Clinical care and consultation workflows'),
  ('patient', 'Patient', 'Patient portal access'),
  ('receptionist', 'Receptionist', 'Front desk scheduling and queue operations');

INSERT INTO users (role_id, full_name, email, password_hash, phone, status)
SELECT
  r.id,
  seed.full_name,
  seed.email,
  crypt(seed.password, gen_salt('bf')),
  seed.phone,
  'active'
FROM (
  VALUES
    ('admin', 'Asha Menon', 'admin@mediconnect.local', 'Password@123', '+91-9000000001'),
    ('doctor', 'Dr. Rohan Mehta', 'doctor@mediconnect.local', 'Password@123', '+91-9000000002'),
    ('patient', 'Maya Rao', 'patient@mediconnect.local', 'Password@123', '+91-9000000003'),
    ('receptionist', 'Nina Kapoor', 'reception@mediconnect.local', 'Password@123', '+91-9000000004')
) AS seed(role_code, full_name, email, password, phone)
JOIN roles r ON r.code = seed.role_code;

INSERT INTO patients (
  user_id,
  medical_record_number,
  date_of_birth,
  gender,
  blood_group,
  emergency_contact_name,
  emergency_contact_phone,
  address,
  insurance_provider,
  insurance_member_id,
  allergies,
  chronic_conditions
)
SELECT
  u.id,
  'MRN-10001',
  DATE '1992-06-18',
  'female',
  'B+',
  'Rakesh Rao',
  '+91-9876543210',
  '14 Green Avenue, Bengaluru',
  'MediSure',
  'INS-44382',
  'Penicillin',
  'Seasonal asthma'
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE r.code = 'patient' AND u.email = 'patient@mediconnect.local';

INSERT INTO doctors (
  user_id,
  employee_code,
  specialization,
  department,
  license_number,
  experience_years,
  rating,
  consultation_fee_cents,
  biography
)
SELECT
  u.id,
  'DOC-1001',
  'Cardiology',
  'Cardiac Sciences',
  'KMC-778812',
  12,
  4.8,
  6500,
  'Consultant cardiologist focused on chronic disease management and post-operative follow up.'
FROM users u
JOIN roles r ON r.id = u.role_id
WHERE r.code = 'doctor' AND u.email = 'doctor@mediconnect.local';

INSERT INTO doctor_availability_rules (doctor_id, weekday, start_time, end_time, slot_minutes)
SELECT d.id, rules.weekday, rules.start_time, rules.end_time, 30
FROM doctors d
CROSS JOIN (
  VALUES
    (1, TIME '09:00', TIME '13:00'),
    (1, TIME '14:00', TIME '17:00'),
    (2, TIME '09:00', TIME '13:00'),
    (2, TIME '14:00', TIME '17:00'),
    (3, TIME '09:00', TIME '13:00'),
    (3, TIME '14:00', TIME '17:00'),
    (4, TIME '09:00', TIME '13:00'),
    (4, TIME '14:00', TIME '17:00'),
    (5, TIME '09:00', TIME '13:00'),
    (5, TIME '14:00', TIME '17:00')
) AS rules(weekday, start_time, end_time)
WHERE d.employee_code = 'DOC-1001';

WITH seed_patient AS (
  SELECT p.id AS patient_id, u.id AS patient_user_id
  FROM patients p
  JOIN users u ON u.id = p.user_id
  WHERE u.email = 'patient@mediconnect.local'
),
seed_doctor AS (
  SELECT d.id AS doctor_id, u.id AS doctor_user_id, d.consultation_fee_cents
  FROM doctors d
  JOIN users u ON u.id = d.user_id
  WHERE u.email = 'doctor@mediconnect.local'
),
seed_reception AS (
  SELECT u.id AS receptionist_user_id
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE r.code = 'receptionist'
)
INSERT INTO appointments (
  patient_id,
  doctor_id,
  booked_by_user_id,
  scheduled_start,
  scheduled_end,
  appointment_type,
  consultation_mode,
  reason,
  status,
  priority,
  queue_number
)
SELECT
  sp.patient_id,
  sd.doctor_id,
  sr.receptionist_user_id,
  timezone('UTC', date_trunc('day', now()) + interval '1 day' + interval '10 hour'),
  timezone('UTC', date_trunc('day', now()) + interval '1 day' + interval '10 hour 30 minute'),
  'follow_up',
  'in_person',
  'Chest discomfort follow-up',
  'confirmed',
  'routine',
  1
FROM seed_patient sp
CROSS JOIN seed_doctor sd
CROSS JOIN seed_reception sr;

WITH seed_appointment AS (
  SELECT a.id, a.patient_id, a.doctor_id
  FROM appointments a
  ORDER BY a.id ASC
  LIMIT 1
)
INSERT INTO medical_records (
  patient_id,
  appointment_id,
  doctor_id,
  encounter_type,
  chief_complaint,
  diagnosis,
  clinical_notes,
  doctor_notes,
  vitals,
  lab_summary,
  follow_up_in_days
)
SELECT
  sa.patient_id,
  sa.id,
  sa.doctor_id,
  'outpatient',
  'Intermittent chest discomfort',
  'Stable angina under monitoring',
  'Symptoms improved with medication adherence and dietary changes.',
  'Continue anti-anginal therapy and monitor blood pressure weekly.',
  '{"bp":"128/82","pulse":"76 bpm","spo2":"99%"}'::jsonb,
  'Troponin negative, ECG stable compared to previous visit.',
  30
FROM seed_appointment sa;

WITH seed_record AS (
  SELECT mr.id, mr.patient_id, mr.doctor_id, mr.appointment_id
  FROM medical_records mr
  ORDER BY mr.id ASC
  LIMIT 1
)
INSERT INTO prescriptions (
  medical_record_id,
  appointment_id,
  patient_id,
  doctor_id,
  medication_name,
  dosage,
  frequency,
  duration_days,
  instructions
)
SELECT
  sr.id,
  sr.appointment_id,
  sr.patient_id,
  sr.doctor_id,
  meds.medication_name,
  meds.dosage,
  meds.frequency,
  meds.duration_days,
  meds.instructions
FROM seed_record sr
CROSS JOIN (
  VALUES
    ('Aspirin', '75 mg', 'Once daily after breakfast', 30, 'Continue unless bleeding symptoms occur'),
    ('Atorvastatin', '20 mg', 'Once daily at bedtime', 30, 'Avoid missing doses')
) AS meds(medication_name, dosage, frequency, duration_days, instructions);

WITH seed_data AS (
  SELECT
    a.id AS appointment_id,
    a.patient_id,
    u.id AS patient_user_id,
    d.consultation_fee_cents
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN users u ON u.id = p.user_id
  JOIN doctors d ON d.id = a.doctor_id
  ORDER BY a.id ASC
  LIMIT 1
)
INSERT INTO payments (
  appointment_id,
  patient_id,
  initiated_by_user_id,
  provider,
  amount_cents,
  currency,
  status,
  invoice_number,
  payment_method_label,
  paid_at,
  metadata
)
SELECT
  sd.appointment_id,
  sd.patient_id,
  sd.patient_user_id,
  'stripe',
  sd.consultation_fee_cents,
  'INR',
  'paid',
  'INV-10001',
  'Demo card',
  now(),
  '{"note":"Seed invoice for demo"}'::jsonb
FROM seed_data sd;

INSERT INTO notifications (user_id, channel, event_type, title, body, status)
SELECT
  u.id,
  'in_app',
  'appointment.confirmed',
  'Appointment confirmed',
  'Your cardiology follow-up appointment has been confirmed for tomorrow at 10:00.',
  'sent'
FROM users u
WHERE u.email IN ('patient@mediconnect.local', 'doctor@mediconnect.local');
