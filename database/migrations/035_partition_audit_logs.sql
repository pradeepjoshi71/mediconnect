-- Migration 035: Partition audit_logs table by month (PostgreSQL native range partitioning)
-- Zero-downtime deploy path: create new partitioned table, backfill data, swap table names.

DO $$
DECLARE
  y INT;
  m INT;
  start_date TEXT;
  end_date   TEXT;
  part_name  TEXT;
BEGIN
  -- Only execute if audit_logs exists and is NOT ALREADY partitioned (relkind 'p' = partitioned table)
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'audit_logs' AND c.relkind != 'p'
  ) THEN

    -- 1. Create temporary partitioned table
    CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
      id BIGINT NOT NULL DEFAULT nextval('audit_logs_id_seq'),
      hospital_id INTEGER NOT NULL REFERENCES hospitals(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      actor_role VARCHAR(30),
      action VARCHAR(120) NOT NULL,
      entity_type VARCHAR(80) NOT NULL,
      entity_id VARCHAR(80),
      request_id VARCHAR(80),
      ip_address TEXT,
      user_agent TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      old_value JSONB,
      new_value JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (id, created_at)
    ) PARTITION BY RANGE (created_at);

    -- 2. Create monthly partitions for historical and future coverage (2025 .. 2027)
    FOR y IN 2025..2027 LOOP
      FOR m IN 1..12 LOOP
        start_date := format('%s-%s-01 00:00:00+00', y, lpad(m::text, 2, '0'));
        end_date   := CASE WHEN m = 12
                           THEN format('%s-01-01 00:00:00+00', y + 1)
                           ELSE format('%s-%s-01 00:00:00+00', y, lpad((m + 1)::text, 2, '0'))
                      END;
        part_name  := format('audit_logs_y%sm%s', y, lpad(m::text, 2, '0'));

        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
          EXECUTE format(
            'CREATE TABLE %I PARTITION OF audit_logs_partitioned FOR VALUES FROM (%L) TO (%L);',
            part_name, start_date, end_date
          );
        END IF;
      END LOOP;
    END LOOP;

    -- Create DEFAULT partition to safely catch any out-of-range historical/future timestamps
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'audit_logs_default') THEN
      CREATE TABLE audit_logs_default PARTITION OF audit_logs_partitioned DEFAULT;
    END IF;

    -- 3. Backfill existing records from unpartitioned table
    INSERT INTO audit_logs_partitioned (
      id, hospital_id, user_id, actor_role, action, entity_type, entity_id,
      request_id, ip_address, user_agent, metadata, old_value, new_value, created_at
    )
    SELECT
      id, hospital_id, user_id, actor_role, action, entity_type, entity_id,
      request_id, ip_address, user_agent, metadata, old_value, new_value, created_at
    FROM audit_logs
    ON CONFLICT DO NOTHING;

    -- Reset sequence value to max(id)
    PERFORM setval('audit_logs_id_seq', COALESCE((SELECT MAX(id) FROM audit_logs_partitioned), 1));

    -- 4. Swap table names atomically
    ALTER TABLE audit_logs RENAME TO audit_logs_old;
    ALTER TABLE audit_logs_partitioned RENAME TO audit_logs;

    -- 5. Re-apply indexes on partitioned table
    CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital_created ON audit_logs (hospital_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_hospital_action ON audit_logs (hospital_id, action, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs (hospital_id, entity_type, entity_id, created_at DESC);

    -- 6. Re-apply append-only protection triggers
    CREATE OR REPLACE FUNCTION protect_audit_logs()
    RETURNS TRIGGER AS $trg$
    BEGIN
      RAISE EXCEPTION 'Audit logs are append-only. Modification or deletion is not allowed.';
    END;
    $trg$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_protect_audit_logs_delete ON audit_logs;
    CREATE TRIGGER trg_protect_audit_logs_delete
      BEFORE DELETE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION protect_audit_logs();

    DROP TRIGGER IF EXISTS trg_protect_audit_logs_update ON audit_logs;
    CREATE TRIGGER trg_protect_audit_logs_update
      BEFORE UPDATE ON audit_logs
      FOR EACH ROW
      EXECUTE FUNCTION protect_audit_logs();

  END IF;
END $$;
