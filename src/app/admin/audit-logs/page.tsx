'use client';
import { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import { Activity, ShieldAlert, Key, UserPlus, Database } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/audit-logs', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(res => res.json())
      .then(data => {
        setLogs(data.data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.loading}>Loading System Activity...</div>;

  const getActionIcon = (action: string) => {
    if (action.includes('LOGIN')) return <Key size={16} color="#3b82f6" />;
    if (action.includes('CREATE')) return <UserPlus size={16} color="#10b981" />;
    if (action.includes('DELETE') || action.includes('ERROR')) return <ShieldAlert size={16} color="#ef4444" />;
    return <Database size={16} color="#64748b" />;
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Audit Logs</h1>
          <p>Security tracker for all system actions</p>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log: any) => (
              <tr key={log.id}>
                <td style={{ color: '#64748b', fontSize: '12px' }}>
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td style={{ fontWeight: 600 }}>{log.actorName || 'System'}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: '#334155' }}>
                    {getActionIcon(log.action)} {log.action}
                  </div>
                </td>
                <td>
                  <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '4px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase' }}>
                    {log.entityType || 'SYSTEM'} #{log.entityId || '-'}
                  </span>
                </td>
                <td style={{ color: '#64748b', fontSize: '13px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {log.details || '-'}
                </td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px 40px', color: '#64748b' }}>
                  <Activity size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                  <p>No audit logs recorded yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
