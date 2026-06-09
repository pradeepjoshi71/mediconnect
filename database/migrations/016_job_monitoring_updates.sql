-- Migration 016: Job Monitoring Schema Updates
-- Extends check constraints to allow new background jobs and seeds default schedules.

-- Extend backup_logs.backup_type check constraint
ALTER TABLE backup_logs DROP CONSTRAINT IF EXISTS backup_logs_backup_type_check;
ALTER TABLE backup_logs ADD CONSTRAINT backup_logs_backup_type_check
  CHECK (backup_type IN ('database', 'storage', 'notification_job', 'push_retry_job', 'cleanup_job'));

-- Extend backup_scheduler_config.backup_type check constraint
ALTER TABLE backup_scheduler_config DROP CONSTRAINT IF EXISTS backup_scheduler_config_backup_type_check;
ALTER TABLE backup_scheduler_config ADD CONSTRAINT backup_scheduler_config_backup_type_check
  CHECK (backup_type IN ('database', 'storage', 'notification_job', 'push_retry_job', 'cleanup_job'));

-- Seed configurations for new periodic jobs
INSERT INTO backup_scheduler_config (backup_type, cron_expression, retention_days, enabled)
VALUES
  ('notification_job', '*/5 * * * *', 7, true), -- runs every 5 minutes
  ('push_retry_job',    '*/10 * * * *', 7, true), -- runs every 10 minutes
  ('cleanup_job',       '0 1 * * *', 7, true)    -- runs daily at 01:00 AM
ON CONFLICT (backup_type) DO NOTHING;
