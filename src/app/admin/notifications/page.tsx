'use client';
import { useEffect, useState } from 'react';
import styles from '../admin.module.css';
import { Bell, Smartphone, Send, CheckCircle2, XCircle, Clock } from 'lucide-react';

export default function NotificationsPage() {
  const [data, setData] = useState<{fcm: any[], sms: any[]}>({ fcm: [], sms: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'SMS' | 'FCM'>('SMS');

  useEffect(() => {
    fetch('/api/notifications', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    })
      .then(res => res.json())
      .then(res => {
        setData(res.data || { fcm: [], sms: [] });
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className={styles.loading}>Loading Notification Logs...</div>;

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'SENT': return <span className={`${styles.badge} ${styles.badgeActive}`}><CheckCircle2 size={14} /> Sent</span>;
      case 'FAILED': return <span className={`${styles.badge} ${styles.badgeError}`}><XCircle size={14} /> Failed</span>;
      default: return <span className={`${styles.badge} ${styles.badgeWarning}`}><Clock size={14} /> Pending</span>;
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Notification Logs</h1>
          <p>Track delivery status of automated SMS and Push Notifications</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
        <button 
          onClick={() => setActiveTab('SMS')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'SMS' ? '#2563eb' : 'white', color: activeTab === 'SMS' ? 'white' : '#64748b', border: activeTab === 'SMS' ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Smartphone size={18} /> SMS Logs
        </button>
        <button 
          onClick={() => setActiveTab('FCM')}
          style={{ padding: '10px 20px', backgroundColor: activeTab === 'FCM' ? '#2563eb' : 'white', color: activeTab === 'FCM' ? 'white' : '#64748b', border: activeTab === 'FCM' ? 'none' : '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Bell size={18} /> Push (FCM) Logs
        </button>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        {activeTab === 'SMS' ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Recipient Mobile</th>
                <th>Message Snippet</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.sms.map((log: any) => (
                <tr key={log.id}>
                  <td style={{ color: '#64748b', fontSize: '13px' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{log.recipientMobile}</td>
                  <td style={{ color: '#475569', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.message}</td>
                  <td>{getStatusBadge(log.status)}</td>
                  <td>{log.attemptCount}</td>
                </tr>
              ))}
              {data.sms.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <Send size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <p>No SMS logs recorded yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Recipient Type</th>
                <th>ID</th>
                <th>Status</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {data.fcm.map((log: any) => (
                <tr key={log.id}>
                  <td style={{ color: '#64748b', fontSize: '13px' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td style={{ fontWeight: 600 }}>{log.recipientType}</td>
                  <td>#{log.recipientId}</td>
                  <td>{getStatusBadge(log.status)}</td>
                  <td>{log.attemptCount}</td>
                </tr>
              ))}
              {data.fcm.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '60px', color: '#64748b' }}>
                    <Bell size={48} color="#cbd5e1" style={{ margin: '0 auto 16px' }} />
                    <p>No Push Notification logs recorded yet.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
