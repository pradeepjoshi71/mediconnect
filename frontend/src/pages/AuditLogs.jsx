import React, { useState, useEffect, useCallback } from 'react';
import hospitalService from '../services/hospitalService';
import { PageHeader } from "../components/ui/PageHeader";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { PaginatedTable } from "../components/ui/PaginatedTable";

const ACTION_LABELS = {
  LOGIN: 'Login',
  LOGOUT: 'Logout',
  'seed.account.provisioned': 'Account Provisioned',
  'department.created': 'Department Created',
  'patient.record.viewed': 'Patient Record Viewed',
  'prescription.updated': 'Prescription Updated',
  'invoice.updated': 'Invoice Updated',
  'doctor.updated': 'Doctor Updated',
};

const STATUS_COLORS = {
  SUCCESS: '#22c55e',
  FAILURE: '#ef4444',
};

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ action: '', from: '', to: '' });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (filters.action) params.action = filters.action;
      if (filters.from)   params.from   = filters.from;
      if (filters.to)     params.to     = filters.to;
      const data = await hospitalService.getAuditLogs(params);
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const columns = [
    {
      key: "time",
      label: "Time",
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: "action",
      label: "Action",
      render: (row) => (
        <Badge tone="brand" className="font-semibold text-xs">
          {ACTION_LABELS[row.action] || row.action}
        </Badge>
      ),
    },
    {
      key: "user",
      label: "User",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-900 dark:text-white">{row.userName || "—"}</span>
          {row.userEmail && <span className="text-[10px] text-slate-405 dark:text-slate-500">{row.userEmail}</span>}
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      render: (row) => (
        <Badge tone={row.actorRole === "doctor" ? "teal" : row.actorRole === "super_admin" || row.actorRole === "hospital_admin" ? "brand" : "slate"} className="capitalize text-[10px]">
          {row.actorRole?.replace("_", " ") || "—"}
        </Badge>
      ),
    },
    {
      key: "entity",
      label: "Entity",
      render: (row) => (
        row.entityType ? (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.entityType} #{row.entityId}
          </span>
        ) : "—"
      ),
    },
    {
      key: "ip",
      label: "IP Address",
      render: (row) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {row.ipAddress || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{
              backgroundColor: STATUS_COLORS[row.status] || "#64748b",
            }}
          />
          <span className="text-xs font-semibold">
            {row.status?.toLowerCase()}
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        eyebrow="Security & Audit"
        title="System Audit Trail"
        description={`Review chronological records of administrative events, authentications, and clinical updates. (${total.toLocaleString()} events recorded)`}
      />

      {/* Filters */}
      <form onSubmit={handleFilter} className="flex flex-wrap items-center gap-3 rounded-[24px] border border-slate-200/50 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="w-full sm:w-48">
          <Select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            options={[
              { value: "", label: "All Actions" },
              { value: "LOGIN", label: "Login" },
              { value: "LOGOUT", label: "Logout" },
              { value: "department.created", label: "Department Created" },
              { value: "seed.account.provisioned", label: "Account Provisioned" }
            ]}
          />
        </div>
        <div className="w-full sm:w-40">
          <Input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
            placeholder="From Date"
          />
        </div>
        <div className="w-full sm:w-40">
          <Input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
            placeholder="To Date"
          />
        </div>
        <Button variant="primary" type="submit" className="h-11">
          Apply Filters
        </Button>
        {(filters.action || filters.from || filters.to) && (
          <Button
            variant="ghost"
            type="button"
            className="text-xs font-semibold text-slate-550 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => {
              setFilters({ action: "", from: "", to: "" });
              setPage(1);
            }}
          >
            Clear
          </Button>
        )}
      </form>

      {/* Table */}
      <div className="rounded-[28px] border border-white/70 bg-white/90 p-6 shadow-card backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/85">
        <PaginatedTable
          rows={logs}
          columns={columns}
          loading={loading}
          pageSize={50} // Use backend-supplied limit
        />
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex items-center justify-between px-5 py-4 border border-slate-200/40 bg-white/80 dark:border-neutral-200/10 dark:bg-neutral-100/70 rounded-2xl shadow-sm">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Showing Page {page} of {Math.ceil(total / 50)} ({total.toLocaleString()} total entries)
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => {
                setPage((p) => Math.max(1, p - 1));
              }}
            >
              ← Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / 50)}
              onClick={() => {
                setPage((p) => p + 1);
              }}
            >
              Next →
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
