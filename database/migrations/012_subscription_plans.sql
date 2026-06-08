-- Migration: 012_subscription_plans.sql
-- Subscription plan catalogue and per-tenant subscriptions

CREATE TABLE IF NOT EXISTS subscription_plans (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(80)  NOT NULL,
  code            VARCHAR(40)  NOT NULL UNIQUE,
  price_cents     INTEGER      NOT NULL DEFAULT 0,
  doctor_limit    INTEGER,          -- NULL = unlimited
  patient_limit   INTEGER,          -- NULL = unlimited
  storage_gb      INTEGER      NOT NULL DEFAULT 5,
  duration_days   INTEGER      NOT NULL DEFAULT 30,
  is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
  features        JSONB        NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hospital_subscriptions (
  id              SERIAL PRIMARY KEY,
  hospital_id     INTEGER      NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
  plan_id         INTEGER      NOT NULL REFERENCES subscription_plans(id),
  status          VARCHAR(20)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('trialing','active','expired','cancelled')),
  started_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ  NOT NULL,
  assigned_by     INTEGER      REFERENCES users(id) ON DELETE SET NULL,
  notes           TEXT,
  upgrade_request TEXT,
  upgrade_requested_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hosp_subs_hospital ON hospital_subscriptions(hospital_id);
CREATE INDEX IF NOT EXISTS idx_hosp_subs_status   ON hospital_subscriptions(status);

-- Seed plans
INSERT INTO subscription_plans (name, code, price_cents, doctor_limit, patient_limit, storage_gb, duration_days, features)
VALUES
  ('Trial',        'trial',      0,       5,    500,  5,   30, '{"telemedicine":false,"lab":true,"pharmacy":false}'::jsonb),
  ('Basic',        'basic',      499900,  15,   2000, 20,  30, '{"telemedicine":false,"lab":true,"pharmacy":true}'::jsonb),
  ('Professional', 'pro',        999900,  50,   NULL, 100, 30, '{"telemedicine":true,"lab":true,"pharmacy":true}'::jsonb),
  ('Enterprise',   'enterprise', 2499900, NULL, NULL, 500, 30, '{"telemedicine":true,"lab":true,"pharmacy":true,"dedicated_support":true}'::jsonb)
ON CONFLICT (code) DO NOTHING;
