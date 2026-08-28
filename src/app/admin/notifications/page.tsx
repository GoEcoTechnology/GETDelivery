'use client';
import { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import { Bell, Mail, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function NotificationsPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(res => res.json())
      .then(res => {
        setData(res.notifications || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.loading}>Loading Notification Logs...</div>;

  const getStatusBadge = (status: string) => {
    switch(status.toUpperCase()) {
      case 'READ': 
      case 'SENT': return <span className={`${styles.badge} ${styles.badgeActive}`}><CheckCircle2 size={14} /> {status}</span>;
      case 'FAILED': return <span className={`${styles.badge} ${styles.badgeError}`}><XCircle size={14} /> Failed</span>;
      default: return <span className={`${styles.badge} ${styles.badgeWarning}`}><Clock size={14} /> {status}</span>;
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Notification Logs</h1>
          <p>Track delivery status of email and in-app notifications</p>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Type</th>
              <th>Title</th>
              <th>Message</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((log: any) => (
              <tr key={log.id}>
                <td style={{ color: '#64748b', fontSize: '13px' }}>{new Date(log.createdAt).toLocaleString()}</td>
                <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>{log.notificationType?.replace(/_/g, ' ')}</td>
                <td style={{ fontWeight: 600 }}>{log.title}</td>
                <td style={{ color: '#475569', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.body}</td>
                <td>{getStatusBadge(log.status)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                  <Mail size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                  <p>No notifications recorded yet.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
