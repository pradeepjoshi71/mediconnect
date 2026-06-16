-- Migration 020: Protect audit_logs table from deletion and modification.
-- Audit logs must be append-only.

CREATE OR REPLACE FUNCTION protect_audit_logs()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are append-only. Modification or deletion is not allowed.';
END;
$$ LANGUAGE plpgsql;

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
