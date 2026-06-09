#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# backup-cron.sh — MediConnect Bare-Metal Backup Script
#
# For deployments NOT using Docker (PM2 bare-metal only).
# In Docker deployments, pg_dump and mc mirror are called from backupScheduler.js
# inside the backend container — this script is for bare-metal fallback only.
#
# Install:
#   chmod +x /opt/mediconnect/deploy/backup-cron.sh
#   sudo crontab -e
#   # Add the following lines:
#   0 2 * * * /opt/mediconnect/deploy/backup-cron.sh database >> /var/log/mediconnect-backup.log 2>&1
#   0 3 * * * /opt/mediconnect/deploy/backup-cron.sh storage  >> /var/log/mediconnect-backup.log 2>&1
#
# Usage:
#   ./backup-cron.sh database     # Run database backup
#   ./backup-cron.sh storage      # Run storage backup
#   ./backup-cron.sh both         # Run both (sequential)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration — edit these to match your .env ──────────────────────────
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-mediconnect}"
PGPASSWORD="${PGPASSWORD:-${DB_PASSWORD:-}}"
export PGPASSWORD

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
LOG_TAG="mediconnect-backup"

# MinIO / mc settings
MC_PATH="${MC_PATH:-mc}"
MINIO_PRIMARY_ALIAS="${MINIO_PRIMARY_ALIAS:-mediconnect-primary}"
MINIO_BACKUP_ALIAS="${MINIO_BACKUP_ALIAS:-mediconnect-backup}"

# ── Helpers ─────────────────────────────────────────────────────────────────
log()  { echo "$(date '+%Y-%m-%d %H:%M:%S') [${LOG_TAG}] $*"; }
die()  { log "ERROR: $*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1. Install it first."
}

# ── Database Backup (pg_dump) ────────────────────────────────────────────────
run_database_backup() {
  log "Starting database backup..."
  require_cmd pg_dump

  mkdir -p "${BACKUP_DIR}"

  TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
  DUMP_FILE="${BACKUP_DIR}/db_${TIMESTAMP}.dump"

  log "Dumping database '${DB_NAME}' to ${DUMP_FILE} ..."
  pg_dump \
    --format=custom \
    --no-password \
    --host="${DB_HOST}" \
    --port="${DB_PORT}" \
    --username="${DB_USER}" \
    --file="${DUMP_FILE}" \
    "${DB_NAME}"

  # Verify dump integrity via PGDMP magic bytes
  MAGIC=$(dd if="${DUMP_FILE}" bs=5 count=1 2>/dev/null | head -c 5)
  if [ "${MAGIC}" != "PGDMP" ]; then
    rm -f "${DUMP_FILE}"
    die "Dump integrity check failed for ${DUMP_FILE} — file deleted"
  fi

  DUMP_SIZE=$(du -sh "${DUMP_FILE}" | cut -f1)
  log "Database backup completed. File: ${DUMP_FILE}, Size: ${DUMP_SIZE}"

  # ── Prune old dumps ──────────────────────────────────────────────────────
  log "Pruning dumps older than ${RETENTION_DAYS} days..."
  find "${BACKUP_DIR}" -name "db_*.dump" -mtime "+${RETENTION_DAYS}" -delete
  REMAINING=$(find "${BACKUP_DIR}" -name "db_*.dump" | wc -l)
  log "Retention pruning complete. ${REMAINING} dump(s) retained."
}

# ── Storage Backup (mc mirror) ───────────────────────────────────────────────
run_storage_backup() {
  log "Starting MinIO storage backup..."

  if ! command -v "${MC_PATH}" >/dev/null 2>&1; then
    die "mc (MinIO client) not found at '${MC_PATH}'. Install it: https://min.io/docs/minio/linux/reference/minio-mc.html"
  fi

  if [ -z "${MINIO_BACKUP_ALIAS}" ]; then
    die "MINIO_BACKUP_ALIAS is not set. Configure mc aliases first (see deploy/minio-setup.sh)."
  fi

  log "Mirroring ${MINIO_PRIMARY_ALIAS}/ → ${MINIO_BACKUP_ALIAS}/ ..."
  "${MC_PATH}" mirror \
    --overwrite \
    --remove \
    "${MINIO_PRIMARY_ALIAS}/" \
    "${MINIO_BACKUP_ALIAS}/"

  OBJECT_COUNT=$("${MC_PATH}" ls "${MINIO_BACKUP_ALIAS}/" --recursive --json 2>/dev/null | wc -l || echo "unknown")
  log "Storage backup completed. Backed-up objects: ${OBJECT_COUNT}"
}

# ── Main ─────────────────────────────────────────────────────────────────────
COMMAND="${1:-both}"

case "${COMMAND}" in
  database)
    run_database_backup
    ;;
  storage)
    run_storage_backup
    ;;
  both)
    run_database_backup
    run_storage_backup
    ;;
  *)
    die "Unknown command '${COMMAND}'. Use: database | storage | both"
    ;;
esac

log "Backup script completed successfully."
