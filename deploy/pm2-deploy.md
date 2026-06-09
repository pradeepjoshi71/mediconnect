# MediConnect — PM2 Production Deployment Guide

## Prerequisites

```bash
# Install PM2 globally on the production server
npm install -g pm2

# Install log rotation module
pm2 install pm2-logrotate

# Configure log rotation (10MB max, keep 30 days)
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:workerInterval 3600
pm2 set pm2-logrotate:rotateInterval 0 0 * * *
```

---

## First-Time Deployment

```bash
# 1. Clone the repository
git clone https://github.com/your-org/mediconnect.git /opt/mediconnect
cd /opt/mediconnect

# 2. Create .env from template
cp .env.example .env
nano .env   # Fill in all production values

# 3. Install dependencies
cd backend && npm ci --omit=dev && cd ..

# 4. Run database migrations
cd backend && node src/scripts/runMigration.js && cd ..

# 5. Create the backup directory (must match BACKUP_DIR in .env)
sudo mkdir -p /backups
sudo chown -R $(whoami):$(whoami) /backups

# 6. (Optional) Configure mc aliases for MinIO replication
#    Run deploy/minio-setup.sh after MinIO services are running
bash deploy/minio-setup.sh

# 7. Start the application in cluster mode
cd backend
pm2 start ecosystem.config.js --env production

# 8. Save PM2 process list so it survives reboots
pm2 save

# 9. Configure PM2 to start on system boot
pm2 startup
# Copy and run the command it prints (e.g. sudo env PATH=... pm2 startup systemd ...)
```

---

## Ongoing Operations

### View Status

```bash
pm2 status                          # All processes
pm2 show mediconnect-api            # Detailed info on one process
pm2 monit                           # Live CPU/memory monitor
```

### Logs

```bash
pm2 logs mediconnect-api            # Tail live logs
pm2 logs mediconnect-api --lines 200  # Last 200 lines
pm2 flush                           # Clear all log files
```

### Zero-Downtime Reload (code updates)

```bash
cd /opt/mediconnect/backend
git pull
npm ci --omit=dev
pm2 reload mediconnect-api          # Rolling reload — no downtime
```

### Restart / Stop

```bash
pm2 restart mediconnect-api         # Hard restart
pm2 stop mediconnect-api            # Stop (keeps in process list)
pm2 delete mediconnect-api          # Remove from process list
```

---

## Scaling

```bash
# Scale to a specific number of workers (overrides instances: 'max' in config)
pm2 scale mediconnect-api 4         # 4 workers
pm2 scale mediconnect-api +2        # Add 2 more workers
pm2 scale mediconnect-api -1        # Remove 1 worker
```

---

## Environment Variables

The `ecosystem.config.js` sets production env via `env_production`. Critical values
must also be in `.env` (the `env_file` path in ecosystem.config.js):

| Variable | Purpose | Example |
| -------- | ------- | ------- |
| `NODE_ENV` | `production` | `production` |
| `BACKUP_DIR` | pg_dump output path | `/backups` |
| `PGPASSWORD` | pg_dump auth | same as `DB_PASSWORD` |
| `MINIO_BACKUP_ALIAS` | mc mirror target | `mediconnect-backup` |
| `MINIO_PRIMARY_ALIAS` | mc mirror source | `mediconnect-primary` |
| `DB_POOL_MAX` | per-worker DB connections | `10` (×workers = total) |

> **DB pool sizing:** With `instances: 'max'` and 4 CPU cores, PM2 spawns 4 workers.
> Set `DB_POOL_MAX=10` → 40 total connections. PostgreSQL default max is 100.
> Adjust based on your PostgreSQL `max_connections` setting.

---

## Backup Scheduler in Cluster Mode

The backup scheduler (`backupScheduler.js`) is gated to run only on **PM2 instance 0**
via the `NODE_APP_INSTANCE === "0"` check in `app.js`. This prevents N duplicate
scheduler timers when running in cluster mode.

To verify only one scheduler is running:

```bash
pm2 logs mediconnect-api | grep "BackupScheduler: initialized"
# Should appear exactly ONCE across all workers
```

---

## Health Verification After Deployment

```bash
# API health
curl https://yourdomain.com/api/v1/health/ready

# Full system health (requires super_admin JWT)
curl -H "Authorization: Bearer <token>" https://yourdomain.com/api/v1/system/health

# Backup scheduler status
curl -H "Authorization: Bearer <token>" https://yourdomain.com/api/v1/system/backup/scheduler
```

---

## Rollback Procedure

```bash
# 1. Stop the application
pm2 stop mediconnect-api

# 2. Restore previous code
cd /opt/mediconnect
git log --oneline -5          # Find the last good commit
git checkout <commit-hash>

# 3. Reinstall dependencies
cd backend && npm ci --omit=dev

# 4. Restart
pm2 start mediconnect-api
```
