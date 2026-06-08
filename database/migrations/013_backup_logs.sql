-- Migration 013: Backup Logs Table
-- Stores records of every scheduled/manual backup attempt.

CREATE TABLE IF NOT EXISTS backup_logs (
  id              BIGSERIAL PRIMARY KEY,
  backup_type     VARCHAR(20)   NOT NULL CHECK (backup_type IN ('database', 'storage')),
  status          VARCHAR(20)   NOT NULL CHECK (status IN ('success', 'failure', 'running')),
  duration_ms     INTEGER,
  size_bytes      BIGINT,
  retention_days  INTEGER       NOT NULL DEFAULT 7,
  message         TEXT,
  error_detail    TEXT,
  triggered_by    VARCHAR(30)   NOT NULL DEFAULT 'scheduler',
  started_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_backup_logs_type_started
  ON backup_logs (backup_type, started_at DESC);

-- Scheduler config table — one row per backup type, stores next_run, last_run,
-- cron expression, and retention policy.
CREATE TABLE IF NOT EXISTS backup_scheduler_config (
  backup_type       VARCHAR(20)  PRIMARY KEY CHECK (backup_type IN ('database', 'storage')),
  enabled           BOOLEAN      NOT NULL DEFAULT true,
  cron_expression   VARCHAR(100) NOT NULL DEFAULT '0 2 * * *',  -- 02:00 daily
  retention_days    INTEGER      NOT NULL DEFAULT 7,
  last_run_at       TIMESTAMPTZ,
  last_run_status   VARCHAR(20),
  next_run_at       TIMESTAMPTZ,
  failed_count      INTEGER      NOT NULL DEFAULT 0,
  success_count     INTEGER      NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Seed default config rows (idempotent)
INSERT INTO backup_scheduler_config (backup_type, cron_expression, retention_days)
  VALUES
    ('database', '0 2 * * *', 7),
    ('storage',  '0 3 * * *', 7)
  ON CONFLICT (backup_type) DO NOTHING;
