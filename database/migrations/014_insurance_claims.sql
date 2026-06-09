-- Migration 014: Insurance Claims Module Tables
-- Sets up insurance providers, policies, claims, and documents.

CREATE TABLE IF NOT EXISTS insurance_providers (
  id             SERIAL PRIMARY KEY,
  hospital_id    INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  code           TEXT NOT NULL,  -- e.g. "STAR-HEALTH"
  contact_email  TEXT,
  contact_phone  TEXT,
  portal_url     TEXT,
  tha_rate       NUMERIC(5,2) DEFAULT 100.00,  -- % of claim covered
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hospital_id, code)
);

CREATE TABLE IF NOT EXISTS insurance_policies (
  id                      SERIAL PRIMARY KEY,
  hospital_id             INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  patient_id              INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  provider_id             INTEGER NOT NULL REFERENCES insurance_providers(id) ON DELETE CASCADE,
  policy_number           TEXT NOT NULL,
  member_id               TEXT,
  group_number            TEXT,
  plan_name               TEXT,
  coverage_type           TEXT DEFAULT 'individual',
  coverage_amount_cents   INTEGER NOT NULL DEFAULT 0,   -- max coverage limit in cents
  deductible_cents        INTEGER DEFAULT 0,
  co_pay_percent          NUMERIC(5,2) DEFAULT 0,
  effective_date          DATE NOT NULL,
  expiry_date             DATE NOT NULL,
  status                  TEXT DEFAULT 'active' CHECK(status IN ('active','expired','cancelled')),
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  UNIQUE(hospital_id, policy_number)
);

CREATE TABLE IF NOT EXISTS insurance_claims (
  id                      SERIAL PRIMARY KEY,
  hospital_id             INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  claim_number            TEXT NOT NULL UNIQUE,          -- system-generated
  policy_id               INTEGER NOT NULL REFERENCES insurance_policies(id) ON DELETE CASCADE,
  patient_id              INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  invoice_id              INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  claimed_amount_cents    INTEGER NOT NULL,
  approved_amount_cents   INTEGER,
  settlement_amount_cents INTEGER,
  status                  TEXT NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','under_review','approved','rejected','settled','cancelled')),
  submitted_at            TIMESTAMPTZ DEFAULT now(),
  reviewed_at             TIMESTAMPTZ,
  settled_at              TIMESTAMPTZ,
  rejection_reason        TEXT,
  reviewer_user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  settlement_reference    TEXT,       -- insurer's settlement/TPA ref number
  notes                   TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS claim_documents (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  claim_id        INTEGER NOT NULL REFERENCES insurance_claims(id) ON DELETE CASCADE,
  uploaded_by     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_type   TEXT NOT NULL CHECK(document_type IN ('bill','discharge_summary','prescription','lab_report','id_proof','other')),
  original_name   TEXT NOT NULL,
  object_key      TEXT NOT NULL,  -- MinIO key in insurance-claims bucket
  mime_type       TEXT,
  byte_size       INTEGER,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Triggers to set updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_insurance_providers_updated_at ON insurance_providers;
CREATE TRIGGER trg_insurance_providers_updated_at
  BEFORE UPDATE ON insurance_providers
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_insurance_policies_updated_at ON insurance_policies;
CREATE TRIGGER trg_insurance_policies_updated_at
  BEFORE UPDATE ON insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_insurance_claims_updated_at ON insurance_claims;
CREATE TRIGGER trg_insurance_claims_updated_at
  BEFORE UPDATE ON insurance_claims
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_insurance_policies_patient ON insurance_policies(hospital_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_patient   ON insurance_claims(hospital_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_status    ON insurance_claims(hospital_id, status);
CREATE INDEX IF NOT EXISTS idx_claim_documents_claim      ON claim_documents(claim_id);
