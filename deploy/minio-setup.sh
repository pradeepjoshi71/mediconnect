#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# minio-setup.sh — Configure mc aliases for MediConnect MinIO instances
#
# Run this once after MinIO services are up.
# Requires mc (MinIO client) to be installed on the host.
#
# Install mc:
#   curl -O https://dl.min.io/client/mc/release/linux-amd64/mc
#   chmod +x mc && sudo mv mc /usr/local/bin/mc
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

MC_PATH="${MC_PATH:-mc}"

# Primary MinIO
PRIMARY_ENDPOINT="${MINIO_PRIMARY_ENDPOINT:-http://localhost:9000}"
PRIMARY_USER="${MINIO_ACCESS_KEY:-minioadmin}"
PRIMARY_PASS="${MINIO_SECRET_KEY:-minioadmin}"
PRIMARY_ALIAS="${MINIO_PRIMARY_ALIAS:-mediconnect-primary}"

# Backup MinIO
BACKUP_ENDPOINT="${MINIO_BACKUP_ENDPOINT:-http://localhost:9002}"
BACKUP_USER="${MINIO_BACKUP_ACCESS_KEY:-minioadmin}"
BACKUP_PASS="${MINIO_BACKUP_SECRET_KEY:-minioadmin}"
BACKUP_ALIAS="${MINIO_BACKUP_ALIAS:-mediconnect-backup}"

echo "Configuring mc alias: ${PRIMARY_ALIAS} → ${PRIMARY_ENDPOINT}"
"${MC_PATH}" alias set "${PRIMARY_ALIAS}" "${PRIMARY_ENDPOINT}" "${PRIMARY_USER}" "${PRIMARY_PASS}"

echo "Configuring mc alias: ${BACKUP_ALIAS} → ${BACKUP_ENDPOINT}"
"${MC_PATH}" alias set "${BACKUP_ALIAS}" "${BACKUP_ENDPOINT}" "${BACKUP_USER}" "${BACKUP_PASS}"

echo "Verifying connectivity..."
"${MC_PATH}" admin info "${PRIMARY_ALIAS}" || echo "WARNING: Could not connect to primary MinIO"
"${MC_PATH}" admin info "${BACKUP_ALIAS}"  || echo "WARNING: Could not connect to backup MinIO"

echo "mc aliases configured successfully."
echo ""
echo "To test mirroring manually:"
echo "  mc mirror --overwrite ${PRIMARY_ALIAS}/ ${BACKUP_ALIAS}/"
