'use client';
import { useQuery } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Clock } from 'lucide-react';

export default function DashboardRecentTables() {
  const { data: recent, isLoading } = useQuery({
    queryKey: ['dashboard-recent'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/recent', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) throw new Error('Failed to fetch recent data');
      return res.json();
    },
    staleTime: 60 * 1000
  });

  if (isLoading) return <div style={{ padding: '20px', color: '#64748b' }}>Loading recent activity...</div>;
  if (!recent) return null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', height: '100%' }}>
      <div style={{ background: 'white', borderRadius: '18px', padding: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <Clock size={18} color="#3b82f6" /> Delivery
        </h3>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', paddingBottom: '8px' }}>
          <table className={styles.table} style={{ minWidth: '400px' }}>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {recent.recentDeliveries?.length === 0 ? (
              <tr><td colSpan={3} style={{ textAlign: 'center', color: '#64748b' }}>No recent deliveries</td></tr>
            ) : (
              recent.recentDeliveries?.map((d: any) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.customerName || 'Unknown'}</td>
                  <td>
                    <span style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}>
                      {(d.status === 'TEMPORARY_WINNER' ? 'ACCEPTED' : d.status).replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '14px' }}>
                    {new Date(d.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

