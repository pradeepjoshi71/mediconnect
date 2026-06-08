import {
  Activity,
  AlertTriangle,
  Archive,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  Shield,
  Users,
  Building2,
  Clock,
  Wifi,
  WifiOff,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import systemHealthService from "../services/systemHealthService";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function statusTone(status) {
  if (!status) return "slate";
  const s = status.toLowerCase();
  if (["healthy", "connected", "ready"].includes(s)) return "success";
  if (["degraded", "stale", "disabled"].includes(s)) return "amber";
  if (["error", "disconnected", "not_configured"].includes(s)) return "danger";
  return "slate";
}

function StatusDot({ status }) {
  const colors = {
    success: "bg-emerald-500",
    amber: "bg-amber-500",
    danger: "bg-rose-500",
    slate: "bg-slate-400",
  };
  const pulse = statusTone(status) === "success" ? "animate-pulse" : "";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${colors[statusTone(status)]} ${pulse}`}
    />
  );
}

function HealthCard({ icon: Icon, label, status, latencyMs, detail, accent = "brand" }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`grid h-9 w-9 place-items-center rounded-xl ${
              accent === "teal"
                ? "bg-tealish-50 text-tealish-600 dark:bg-tealish-500/10 dark:text-tealish-400"
                : "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
            }`}
          >
            <Icon className="h-4.5 w-4.5" />
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{label}</span>
        </div>
        <StatusDot status={status} />
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={statusTone(status)} className="text-[10px] uppercase tracking-wider">
          {status || "unknown"}
        </Badge>
        {latencyMs != null && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            {latencyMs}ms
          </span>
        )}
      </div>
      {detail && (
        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{detail}</p>
      )}
    </div>
  );
}

// ─── BackupSection (Phase 5.0 — WAL / MinIO status panel) ────────────────────

function BackupSection({ backup, loading }) {
  const [dbExpanded, setDbExpanded] = useState(false);
  const [restoreExpanded, setRestoreExpanded] = useState(false);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="h-40 rounded-2xl bg-slate-100 dark:bg-slate-900/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!backup) return null;

  const db = backup.database || {};
  const storage = backup.storage || {};

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {/* DB WAL Card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                <Database className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">WAL Archiver</div>
                <div className="text-[10px] text-slate-400">pg_stat_archiver status</div>
              </div>
            </div>
            <Badge tone={statusTone(db.status)}>{db.status || "unknown"}</Badge>
          </div>
          {db.lastArchivedAt && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              <Clock className="h-3 w-3 shrink-0" />
              Last archived: {new Date(db.lastArchivedAt).toLocaleString()}
            </div>
          )}
          {db.note && <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed mb-2">{db.note}</p>}
          <button onClick={() => setDbExpanded((v) => !v)} className="flex items-center gap-1 text-[10px] font-semibold text-brand-600 dark:text-brand-400 hover:underline">
            {dbExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {dbExpanded ? "Hide details" : "Show details"}
          </button>
          {dbExpanded && (
            <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800/60 dark:bg-slate-900/30 space-y-1">
              {db.archivedCount != null && <div className="text-[10px] text-slate-500">Archived: <span className="font-bold">{db.archivedCount}</span></div>}
              {db.failedCount != null && <div className="text-[10px] text-slate-500">Failed: <span className={`font-bold ${db.failedCount > 0 ? "text-rose-500" : "text-emerald-500"}`}>{db.failedCount}</span></div>}
              {db.lastFailedWal && <div className="text-[10px] text-rose-500">Last failed WAL: {db.lastFailedWal}</div>}
            </div>
          )}
        </div>

        {/* MinIO Card */}
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-tealish-50 text-tealish-600 dark:bg-tealish-500/10 dark:text-tealish-400">
                <HardDrive className="h-4.5 w-4.5" />
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Object Storage</div>
                <div className="text-[10px] text-slate-400">MinIO connectivity</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {storage.status === "connected" ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-rose-400" />}
              <Badge tone={statusTone(storage.status)}>{storage.status || "unknown"}</Badge>
            </div>
          </div>
          {storage.note && <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed mb-2">{storage.note}</p>}
          {storage.configuredBuckets && (
            <div className="flex flex-wrap gap-1 mt-2">
              {storage.configuredBuckets.map((b) => (
                <span key={b} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">{b}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restore Workflow */}
      {backup.restoreWorkflow && (
        <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
          <button onClick={() => setRestoreExpanded((v) => !v)} className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
                <RotateCcw className="h-4.5 w-4.5" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Restore Workflow</div>
                <div className="text-[10px] text-slate-400">Step-by-step recovery procedures</div>
              </div>
            </div>
            {restoreExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          </button>
          {restoreExpanded && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><Database className="h-3.5 w-3.5" /> Database Restore</div>
                <ol className="space-y-1.5">
                  {backup.restoreWorkflow.database.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="shrink-0 mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-brand-100 text-[9px] font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{i + 1}</span>
                      <code className="leading-relaxed">{step}</code>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="mb-2 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Object Storage Restore</div>
                <ol className="space-y-1.5">
                  {backup.restoreWorkflow.storage.map((step, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="shrink-0 mt-0.5 grid h-4 w-4 place-items-center rounded-full bg-tealish-100 text-[9px] font-bold text-tealish-700 dark:bg-tealish-500/15 dark:text-tealish-300">{i + 1}</span>
                      <code className="leading-relaxed">{step}</code>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── BackupAutomation (Phase 5.1) ─────────────────────────────────────────────

const RETENTION_OPTIONS = [
  { value: 7,  label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];

function LogStatusPill({ status }) {
  const map = {
    success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    failure: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    running: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${map[status] || "bg-slate-100 text-slate-500"}`}>
      {status === "success" && <CheckCircle2 className="h-2.5 w-2.5" />}
      {status === "failure" && <XCircle className="h-2.5 w-2.5" />}
      {status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
      {status}
    </span>
  );
}

function SchedulerCard({ scheduler, onRunNow, onRetentionChange, running }) {
  const isDB = scheduler.backup_type === "database";
  const lastSuccess = scheduler.lastSuccessAt ? new Date(scheduler.lastSuccessAt).toLocaleString() : "Never";
  const nextRun = scheduler.next_run_at ? new Date(scheduler.next_run_at).toLocaleString() : "—";
  const recentFail = scheduler.recentFailures ?? 0;

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/85 p-5 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`grid h-9 w-9 place-items-center rounded-xl ${isDB ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400" : "bg-tealish-50 text-tealish-600 dark:bg-tealish-500/10 dark:text-tealish-400"}`}>
            {isDB ? <Database className="h-4.5 w-4.5" /> : <HardDrive className="h-4.5 w-4.5" />}
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isDB ? "PostgreSQL Backup" : "MinIO Storage Backup"}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{scheduler.cron_expression}</div>
          </div>
        </div>
        <Badge tone={scheduler.enabled ? "success" : "slate"}>
          {scheduler.enabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-2.5">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Last Success</div>
          <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{lastSuccess}</div>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/30 p-2.5">
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Next Run</div>
          <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 leading-tight">{nextRun}</div>
        </div>
        <div className={`rounded-xl p-2.5 ${recentFail > 0 ? "bg-rose-50 dark:bg-rose-500/10" : "bg-slate-50 dark:bg-slate-900/30"}`}>
          <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Failures (7d)</div>
          <div className={`text-[10px] font-bold leading-tight ${recentFail > 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>{recentFail}</div>
        </div>
      </div>

      {/* Totals */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400 mb-4">
        <span>✓ <span className="font-bold text-emerald-600">{scheduler.success_count}</span> total succeeded</span>
        <span>✗ <span className="font-bold text-rose-500">{scheduler.failed_count}</span> total failed</span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          value={scheduler.retention_days}
          onChange={(e) => onRetentionChange(scheduler.backup_type, Number(e.target.value))}
        >
          {RETENTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label} retention</option>
          ))}
        </select>

        <button
          onClick={() => onRunNow(scheduler.backup_type)}
          disabled={running === scheduler.backup_type}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-brand-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {running === scheduler.backup_type
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Play className="h-3 w-3" />}
          {running === scheduler.backup_type ? "Running…" : "Run Now"}
        </button>
      </div>
    </div>
  );
}

function BackupLogsTable({ logs, loading, total, page, onPageChange, logFilter, onFilterChange }) {
  const pageSize = 10;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="rounded-2xl border border-slate-200/60 bg-white/85 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
      {/* Table Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800/60">
        <div className="text-sm font-bold text-slate-800 dark:text-slate-200">Backup Logs</div>
        <div className="flex items-center gap-2">
          <select
            value={logFilter}
            onChange={(e) => onFilterChange(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">All types</option>
            <option value="database">Database only</option>
            <option value="storage">Storage only</option>
          </select>
          <span className="text-[10px] text-slate-400">{total} entries</span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-800/50">
              {["Type", "Status", "Duration", "Size", "Retention", "Triggered By", "Started", "Completed"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-slate-50 dark:border-slate-800/30">
                  {Array.from({ length: 8 }).map((__, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ width: `${40 + (j * 7) % 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  <Archive className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <div className="text-sm">No backup logs yet.</div>
                  <div className="text-[10px]">Trigger a manual backup or wait for the scheduler to run.</div>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 dark:border-slate-800/30 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                      {log.backup_type === "database" ? <Database className="h-3 w-3" /> : <HardDrive className="h-3 w-3" />}
                      {log.backup_type}
                    </span>
                  </td>
                  <td className="px-4 py-3"><LogStatusPill status={log.status} /></td>
                  <td className="px-4 py-3 text-slate-500">{log.duration_ms != null ? `${log.duration_ms}ms` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{log.size_bytes ? `${(log.size_bytes / 1024 / 1024).toFixed(1)} MB` : "—"}</td>
                  <td className="px-4 py-3 text-slate-500">{log.retention_days}d</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase ${log.triggered_by === "manual" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800"}`}>
                      {log.triggered_by}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{new Date(log.started_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{log.completed_at ? new Date(log.completed_at).toLocaleString() : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800/60">
          <span className="text-[10px] text-slate-400">Page {page + 1} of {totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onPageChange(page - 1)} disabled={page === 0} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">← Prev</button>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-600 disabled:opacity-40 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400">Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SuperAdminSystemHealth() {
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [backup, setBackup] = useState(null);
  const [schedulers, setSchedulers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logTotal, setLogTotal] = useState(0);
  const [logPage, setLogPage] = useState(0);
  const [logFilter, setLogFilter] = useState("");
  const [runningBackup, setRunningBackup] = useState(null); // 'database' | 'storage' | null
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const LOG_PAGE_SIZE = 10;

  const fetchLogs = useCallback(async (page = 0, type = "") => {
    setLogsLoading(true);
    try {
      const data = await systemHealthService.getBackupLogs({
        limit: LOG_PAGE_SIZE,
        offset: page * LOG_PAGE_SIZE,
        ...(type ? { type } : {}),
      });
      setLogs(data.logs || []);
      setLogTotal(data.total || 0);
    } catch {
      // non-fatal
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const fetchSchedulers = useCallback(async () => {
    try {
      const data = await systemHealthService.getSchedulerConfig();
      setSchedulers(data.schedulers || []);
    } catch {
      // non-fatal — table may not exist until migration runs
    }
  }, []);

  const fetchAll = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [healthData, metricsData, backupData] = await Promise.allSettled([
        systemHealthService.getHealth(),
        systemHealthService.getMonitoring(),
        systemHealthService.getBackupStatus(),
      ]);

      if (healthData.status === "fulfilled") setHealth(healthData.value);
      if (metricsData.status === "fulfilled") setMetrics(metricsData.value.metrics);
      if (backupData.status === "fulfilled") setBackup(backupData.value.backup);

      // Phase 5.1 — parallel but non-blocking
      fetchSchedulers();
      fetchLogs(0, "");

      setLastRefreshed(new Date());
      if (isRefresh) toast.success("System health refreshed");
    } catch {
      toast.error("Failed to load system health data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [fetchSchedulers, fetchLogs]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRunNow = useCallback(async (type) => {
    setRunningBackup(type);
    try {
      await systemHealthService.triggerBackup(type);
      toast.success(`${type === "database" ? "Database" : "Storage"} backup triggered! Logs will update shortly.`);
      // Poll logs after 2s to pick up the new entry
      setTimeout(() => fetchLogs(logPage, logFilter), 2000);
      setTimeout(() => { fetchSchedulers(); fetchLogs(logPage, logFilter); }, 5000);
    } catch {
      toast.error("Failed to trigger backup");
    } finally {
      setRunningBackup(null);
    }
  }, [fetchLogs, fetchSchedulers, logPage, logFilter]);

  const handleRetentionChange = useCallback(async (type, retentionDays) => {
    try {
      await systemHealthService.updateScheduler(type, { retention_days: retentionDays });
      toast.success(`Retention updated to ${retentionDays} days`);
      fetchSchedulers();
    } catch {
      toast.error("Failed to update retention policy");
    }
  }, [fetchSchedulers]);

  const handleLogPageChange = useCallback((newPage) => {
    setLogPage(newPage);
    fetchLogs(newPage, logFilter);
  }, [fetchLogs, logFilter]);

  const handleLogFilterChange = useCallback((type) => {
    setLogFilter(type);
    setLogPage(0);
    fetchLogs(0, type);
  }, [fetchLogs]);

  const checks = health?.checks || {};
  const overallTone = statusTone(health?.overall || "unknown");

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Production Hardening"
        title="System Health & Operations"
        description="Live infrastructure health, monitoring metrics, database backup status, and recovery procedures."
        actions={
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Updated {lastRefreshed.toLocaleTimeString()}
              </span>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchAll(true)}
              loading={refreshing}
            >
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* ─── Overall Status Banner ─────────────────────────────────────────── */}
      {health && (
        <div
          className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
            overallTone === "success"
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-500/10"
              : overallTone === "amber"
              ? "border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-500/10"
              : "border-rose-200 bg-rose-50 dark:border-rose-800/40 dark:bg-rose-500/10"
          }`}
        >
          {overallTone === "success" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
          )}
          <div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              System is{" "}
              <span
                className={
                  overallTone === "success"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {health.overall}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400">
              Last checked: {new Date(health.checkedAt).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {/* ─── Health Checks Grid ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Service Health
        </h2>
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-slate-100 dark:bg-slate-900/40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <HealthCard
              icon={Activity}
              label="API Server"
              status={checks.api?.status}
              latencyMs={checks.api?.latencyMs}
              detail={checks.api?.uptime != null ? `Uptime: ${Math.floor(checks.api.uptime / 3600)}h ${Math.floor((checks.api.uptime % 3600) / 60)}m` : undefined}
              accent="brand"
            />
            <HealthCard
              icon={Database}
              label="Database"
              status={checks.database?.status}
              latencyMs={checks.database?.latencyMs}
              detail={checks.database?.error}
              accent="brand"
            />
            <HealthCard
              icon={HardDrive}
              label="Object Storage"
              status={checks.storage?.status}
              latencyMs={checks.storage?.latencyMs}
              detail={checks.storage?.buckets != null ? `${checks.storage.buckets} buckets configured` : undefined}
              accent="teal"
            />
            <HealthCard
              icon={Server}
              label="Queue / Cache"
              status={checks.queue?.status}
              latencyMs={checks.queue?.latencyMs}
              detail={checks.queue?.enabled === false ? "Redis disabled via env" : checks.queue?.error}
              accent="teal"
            />
          </div>
        )}
      </section>

      {/* ─── Monitoring Widgets ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Platform Monitoring
        </h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Building2}
            label="Active Tenants"
            value={loading ? "—" : (metrics?.activeTenants ?? "—")}
            helper="Active & trial hospitals"
            accent="brand"
          />
          <StatCard
            icon={Users}
            label="Active Users"
            value={loading ? "—" : (metrics?.activeUsers ?? "—")}
            helper="Registered active staff"
            accent="teal"
          />
          <StatCard
            icon={HardDrive}
            label="Stored Files"
            value={loading ? "—" : (metrics?.storageUsage?.totalFiles ?? "—")}
            helper={loading ? "…" : (metrics?.storageUsage?.status === "connected" ? "MinIO connected" : "MinIO disconnected")}
            accent="success"
          />
          <StatCard
            icon={AlertTriangle}
            label="Errors (24h)"
            value={loading ? "—" : (metrics?.errorCount < 0 ? "N/A" : (metrics?.errorCount ?? "—"))}
            helper="From audit log"
            accent={metrics?.errorCount > 0 ? "danger" : "success"}
          />
        </div>

        {/* Secondary metrics */}
        {metrics && !loading && (
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/85 px-4 py-3 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
              <Shield className="h-4 w-4 shrink-0 text-brand-500" />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Total Patients</div>
                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{metrics.totalPatients}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/85 px-4 py-3 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
              <Activity className="h-4 w-4 shrink-0 text-tealish-500" />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Total Doctors</div>
                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">{metrics.totalDoctors}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white/85 px-4 py-3 shadow-card backdrop-blur-md dark:border-neutral-200/10 dark:bg-neutral-100/70">
              <Clock className="h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Server Uptime</div>
                <div className="text-lg font-black text-slate-900 dark:text-white leading-none">
                  {metrics.serverUptime != null
                    ? `${Math.floor(metrics.serverUptime / 3600)}h ${Math.floor((metrics.serverUptime % 3600) / 60)}m`
                    : "—"}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ─── Backup Management (WAL / MinIO status) ───────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Backup Management
          </h2>
          <Badge tone="slate" className="text-[10px]">
            <Archive className="h-3 w-3 mr-1 inline-block" />
            WAL Archiver
          </Badge>
        </div>
        <BackupSection backup={backup} loading={loading} />
      </section>

      {/* ─── Backup Automation (Phase 5.1) ─────────────────────────────────── */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Backup Automation
          </h2>
          <Badge tone="brand" className="text-[10px]">
            <Play className="h-3 w-3 mr-1 inline-block" />
            Daily Scheduler
          </Badge>
        </div>

        {/* Scheduler Cards */}
        {schedulers.length === 0 && !loading ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800/40 dark:bg-amber-500/10 px-5 py-4 text-sm text-amber-700 dark:text-amber-300 mb-4">
            ⚠ Backup scheduler tables not yet created. Run migration <code className="font-mono text-[11px]">013_backup_logs.sql</code> to enable automated backups.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            {schedulers.length === 0 && loading
              ? [1, 2].map((i) => <div key={i} className="h-52 rounded-2xl bg-slate-100 dark:bg-slate-900/40 animate-pulse" />)
              : schedulers.map((s) => (
                  <SchedulerCard
                    key={s.backup_type}
                    scheduler={s}
                    onRunNow={handleRunNow}
                    onRetentionChange={handleRetentionChange}
                    running={runningBackup}
                  />
                ))}
          </div>
        )}

        {/* Backup Logs */}
        <BackupLogsTable
          logs={logs}
          loading={logsLoading}
          total={logTotal}
          page={logPage}
          onPageChange={handleLogPageChange}
          logFilter={logFilter}
          onFilterChange={handleLogFilterChange}
        />
      </section>
    </div>
  );
}
