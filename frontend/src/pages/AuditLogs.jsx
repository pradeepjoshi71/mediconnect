import React, { useState, useEffect, useCallback } from 'react';
import hospitalService from '../services/hospitalService';

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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Audit Logs</h1>
          <p style={styles.subtitle}>{total.toLocaleString()} events recorded</p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleFilter} style={styles.filterBar}>
        <select
          value={filters.action}
          onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
          style={styles.select}
        >
          <option value="">All Actions</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
          <option value="department.created">Department Created</option>
          <option value="seed.account.provisioned">Account Provisioned</option>
        </select>
        <input
          type="date"
          value={filters.from}
          onChange={(e) => setFilters(f => ({ ...f, from: e.target.value }))}
          style={styles.input}
          placeholder="From date"
        />
        <input
          type="date"
          value={filters.to}
          onChange={(e) => setFilters(f => ({ ...f, to: e.target.value }))}
          style={styles.input}
          placeholder="To date"
        />
        <button type="submit" style={styles.filterBtn}>Apply</button>
        <button type="button" onClick={() => { setFilters({ action: '', from: '', to: '' }); setPage(1); }} style={styles.clearBtn}>
          Clear
        </button>
      </form>

      {/* Table */}
      <div style={styles.tableWrapper}>
        {loading ? (
          <div style={styles.loading}>Loading…</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {['Time', 'Action', 'User', 'Role', 'Entity', 'IP', 'Status'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={7} style={styles.empty}>No audit logs found</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} style={styles.tr}>
                  <td style={styles.td}>
                    <span style={styles.timeText}>
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.actionBadge}>
                      {ACTION_LABELS[log.action] || log.action}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.userCell}>
                      <span style={styles.userName}>{log.userName || '—'}</span>
                      {log.userEmail && <span style={styles.userEmail}>{log.userEmail}</span>}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.roleBadge}>{log.actorRole || '—'}</span>
                  </td>
                  <td style={styles.td}>
                    {log.entityType && (
                      <span style={styles.entityText}>{log.entityType} #{log.entityId}</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <span style={styles.ipText}>{log.ipAddress || '—'}</span>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusDot,
                      background: STATUS_COLORS[log.status] || '#64748b',
                    }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={styles.pageBtn}
          >← Prev</button>
          <span style={styles.pageInfo}>Page {page} of {Math.ceil(total / 50)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            style={styles.pageBtn}
          >Next →</button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '32px',
    background: '#0f172a',
    minHeight: '100vh',
    fontFamily: "'Inter', sans-serif",
    color: '#e2e8f0',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '24px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 700,
    color: '#f8fafc',
    margin: 0,
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    marginTop: '4px',
  },
  filterBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  select: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  input: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: '14px',
  },
  filterBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    padding: '8px 18px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  clearBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#94a3b8',
    padding: '8px 14px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  tableWrapper: {
    background: '#1e293b',
    borderRadius: '12px',
    border: '1px solid #334155',
    overflow: 'hidden',
  },
  loading: {
    textAlign: 'center',
    padding: '40px',
    color: '#94a3b8',
    fontSize: '16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '12px 16px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 600,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid #334155',
    background: '#0f172a',
  },
  tr: {
    borderBottom: '1px solid #1e293b',
    transition: 'background 0.15s',
  },
  td: {
    padding: '12px 16px',
    fontSize: '13px',
    verticalAlign: 'middle',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  actionBadge: {
    background: 'rgba(99,102,241,0.15)',
    color: '#818cf8',
    borderRadius: '6px',
    padding: '3px 8px',
    fontSize: '12px',
    fontWeight: 600,
  },
  userCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userName: {
    color: '#e2e8f0',
    fontWeight: 500,
    fontSize: '13px',
  },
  userEmail: {
    color: '#64748b',
    fontSize: '11px',
  },
  roleBadge: {
    background: 'rgba(34,197,94,0.1)',
    color: '#4ade80',
    borderRadius: '4px',
    padding: '2px 6px',
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  entityText: {
    color: '#94a3b8',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  ipText: {
    color: '#64748b',
    fontSize: '12px',
    fontFamily: 'monospace',
  },
  statusDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  empty: {
    textAlign: 'center',
    padding: '40px',
    color: '#64748b',
    fontSize: '14px',
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    marginTop: '20px',
  },
  pageBtn: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    color: '#e2e8f0',
    padding: '8px 16px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  pageInfo: {
    color: '#94a3b8',
    fontSize: '13px',
  },
};
