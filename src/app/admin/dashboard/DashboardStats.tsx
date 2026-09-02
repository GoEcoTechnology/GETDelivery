'use client';
import { useQuery } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Package, Truck, AlertTriangle, CheckCircle, Clock, Users, CreditCard, Car } from 'lucide-react';

export default function DashboardStats() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats', { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    staleTime: 60 * 1000
  });

  return (
    <div className={styles.grid}>
      <div className={styles.fadeIn} style={{ display: 'contents' }}>
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Active Deliveries</h3>
            <Truck size={20} color="#94a3b8" />
          </div>
          <div>
            <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{stats?.activeDeliveries ?? '-'}</p>
          </div>
        </div>

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Completed</h3>
            <CheckCircle size={20} color="#94a3b8" />
          </div>
          <div>
            <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{stats?.completedDeliveries ?? '-'}</p>
          </div>
        </div>

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Low Stock Items</h3>
            <AlertTriangle size={20} color="#94a3b8" />
          </div>
          <div>
            <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{stats?.lowStockItems ?? '-'}</p>
          </div>
        </div>

        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>Active Customers</h3>
            <Users size={20} color="#94a3b8" />
          </div>
          <div>
            <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{stats?.activeCustomers ?? '-'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
