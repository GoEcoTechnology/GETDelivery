'use client';

import { useState, useEffect, useMemo } from 'react';
import styles from '../admin.module.css';
import {
  ClipboardList,
  Download,
  Info,
  Search,
  RefreshCw,
  Filter,
  Calendar,
  User,
  Shield,
  FileText,
  AlertCircle
} from 'lucide-react';

interface AuditLog {
  id: number;
  action: string;
  actorType?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  details?: string | null;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(true);
  const rowsPerPage = 10;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/audit-logs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter options
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    logs.forEach(l => {
      if (l.actorType) roles.add(l.actorType);
    });
    return Array.from(roles);
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach(l => {
      if (l.action) actions.add(l.action);
    });
    return Array.from(actions);
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchSearch =
        searchTerm === '' ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.actorName && log.actorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.actorEmail && log.actorEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.details && log.details.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.entityId && log.entityId.toString().includes(searchTerm));

      const matchRole =
        selectedRole === 'ALL' ||
        (log.actorType && log.actorType.toUpperCase() === selectedRole.toUpperCase());

      const matchAction =
        selectedAction === 'ALL' ||
        log.action.toUpperCase() === selectedAction.toUpperCase();

      return matchSearch && matchRole && matchAction;
    });
  }, [logs, searchTerm, selectedRole, selectedAction]);

  // Pagination
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
  const currentLogs = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No audit logs available to export.');
      return;
    }

    setExporting(true);
    try {
      const headers = [
        'Log ID',
        'Date & Time',
        'Action',
        'Actor Type',
        'Actor Name',
        'Actor Email',
        'Entity Type',
        'Entity ID',
        'Details'
      ];

      const csvRows = filteredLogs.map(log => [
        log.id,
        `"${new Date(log.createdAt).toLocaleString().replace(/"/g, '""')}"`,
        `"${(log.action || '').replace(/"/g, '""')}"`,
        `"${(log.actorType || 'N/A').replace(/"/g, '""')}"`,
        `"${(log.actorName || 'System').replace(/"/g, '""')}"`,
        `"${(log.actorEmail || 'N/A').replace(/"/g, '""')}"`,
        `"${(log.entityType || '').replace(/"/g, '""')}"`,
        log.entityId ?? '',
        `"${(log.details || '').replace(/"/g, '""')}"`
      ]);

      const csvContent =
        'data:text/csv;charset=utf-8,\uFEFF' +
        [headers.join(','), ...csvRows.map(e => e.join(','))].join('\n');

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('download', `audit_logs_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Export error:', error);
      alert('Failed to export audit logs. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes('ACCEPTED') || action.includes('COMPLETED') || action.includes('SUCCESS')) {
      return { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' };
    }
    if (action.includes('CANCEL') || action.includes('DECLINE') || action.includes('DELETE') || action.includes('FAIL')) {
      return { bg: '#fef2f2', text: '#dc2626', border: '#fecaca' };
    }
    if (action.includes('START') || action.includes('IN_PROGRESS')) {
      return { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' };
    }
    return { bg: '#f8fafc', text: '#475569', border: '#e2e8f0' };
  };

  return (
    <div style={{ padding: '24px 32px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              Audit Logs
            </h1>
            {/* Info Icon with Tooltip */}
            <div
              title="Audit logs are automatically removed from the system after 1 month (30 days)."
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #bfdbfe',
                borderRadius: '9999px',
                padding: '4px 10px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <Info size={14} />
              <span>Auto-removes after 1 month</span>
            </div>
          </div>
          <p style={{ margin: '6px 0 0 0', color: '#64748b', fontSize: '14px' }}>
            System activity trail, order events, and partner driver responses.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              padding: '9px 16px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          {/* Export Button */}
          <button
            onClick={handleExportCSV}
            disabled={exporting || loading || filteredLogs.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#4f46e5',
              color: 'white',
              border: 'none',
              padding: '9px 18px',
              borderRadius: '10px',
              fontWeight: 600,
              fontSize: '13.5px',
              cursor: filteredLogs.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)',
              opacity: filteredLogs.length === 0 ? 0.6 : 1,
              transition: 'all 0.2s'
            }}
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* Info Notice Banner */}
      {showInfoBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            padding: '14px 18px',
            borderRadius: '12px',
            marginBottom: '20px'
          }}
        >
          <Info size={19} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#92400e' }}>
              Data Retention Reminder
            </div>
            <div style={{ fontSize: '13px', color: '#b45309', marginTop: '2px', lineHeight: '1.5' }}>
              To ensure peak database performance, audit logs are <strong>automatically removed after 1 month (30 days)</strong>.
              Use the <strong>Export CSV</strong> button above anytime you wish to download and save your audit history for long-term archiving.
            </div>
          </div>
          <button
            onClick={() => setShowInfoBanner(false)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#b45309',
              fontSize: '18px',
              fontWeight: 700,
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>
      )}

      {/* Filters Card */}
      <div
        className={styles.card}
        style={{
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '14px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', flex: '1 1 280px', maxWidth: '420px', position: 'relative' }}>
          <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            placeholder="Search action, details, actor, ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Role Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Role:</span>
            <select
              value={selectedRole}
              onChange={(e) => {
                setSelectedRole(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: 'white',
                outline: 'none'
              }}
            >
              <option value="ALL">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
          </div>

          {/* Action Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Action:</span>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '7px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                backgroundColor: 'white',
                outline: 'none',
                maxWidth: '220px'
              }}
            >
              <option value="ALL">All Actions</option>
              {uniqueActions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            {filteredLogs.length} records found
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
          <table className={styles.table} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Date &amp; Time</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Actor</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Action</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Entity</th>
                <th style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: '#475569', textAlign: 'left' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td colSpan={5} style={{ padding: '18px 24px' }}>
                      <div
                        style={{
                          height: '16px',
                          borderRadius: '6px',
                          background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
                          backgroundSize: '200% 100%',
                          animation: 'shimmer 1.5s infinite'
                        }}
                      />
                    </td>
                  </tr>
                ))
              ) : currentLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '60px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#94a3b8' }}>
                      <ClipboardList size={36} color="#cbd5e1" />
                      <div style={{ fontWeight: 600, fontSize: '15px', color: '#64748b' }}>No audit logs found</div>
                      <div style={{ fontSize: '13px' }}>Activities will appear here once actions are performed.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                currentLogs.map((log) => {
                  const badge = getActionBadgeColor(log.action);
                  return (
                    <tr
                      key={log.id}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        transition: 'background-color 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b' }}>
                          {new Date(log.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                          {new Date(log.createdAt).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </div>
                      </td>

                      {/* Actor */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {log.actorName || 'System'}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              backgroundColor: log.actorType === 'PARTNER' ? '#eff6ff' : '#f1f5f9',
                              color: log.actorType === 'PARTNER' ? '#2563eb' : '#64748b'
                            }}
                          >
                            {log.actorType || 'SYSTEM'}
                          </span>
                          {log.actorEmail && (
                            <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                              {log.actorEmail}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '14px 16px', fontSize: '13px' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            backgroundColor: badge.bg,
                            color: badge.text,
                            border: `1px solid ${badge.border}`,
                            letterSpacing: '0.02em'
                          }}
                        >
                          {log.action}
                        </span>
                      </td>

                      {/* Entity */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#334155', whiteSpace: 'nowrap' }}>
                        {log.entityType ? (
                          <div>
                            <span style={{ fontWeight: 600, color: '#1e293b' }}>
                              {log.entityType.replace(/_/g, ' ')}
                            </span>
                            {log.entityId && (
                              <span style={{ marginLeft: '6px', color: '#6366f1', fontWeight: 700 }}>
                                #{log.entityId}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Details */}
                      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#475569', maxWidth: '360px' }}>
                        <div
                          style={{
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                            lineHeight: '1.4'
                          }}
                        >
                          {log.details || '—'}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            Showing {filteredLogs.length === 0 ? 0 : (page - 1) * rowsPerPage + 1} to{' '}
            {Math.min(page * rowsPerPage, filteredLogs.length)} of {filteredLogs.length} records
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: page === 1 ? '#f8fafc' : 'white',
                color: page === 1 ? '#94a3b8' : '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page === 1 ? 'not-allowed' : 'pointer'
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', padding: '0 6px' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: page >= totalPages ? '#f8fafc' : 'white',
                color: page >= totalPages ? '#94a3b8' : '#334155',
                fontSize: '13px',
                fontWeight: 600,
                cursor: page >= totalPages ? 'not-allowed' : 'pointer'
              }}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
