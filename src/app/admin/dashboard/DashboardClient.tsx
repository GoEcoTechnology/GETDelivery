'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import styles from '../admin.module.css';
import { Package, Truck, AlertTriangle, CheckCircle, Clock, Users, CreditCard, Car } from 'lucide-react';

const DashboardCharts = dynamic(() => import('./DashboardCharts'), { ssr: false });

export default function DashboardClient({ 
  initialStats, 
  initialChartData, 
  currentRange 
}: { 
  initialStats: any; 
  initialChartData: any; 
  currentRange: string;
}) {
  const router = useRouter();

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const range = e.target.value;
    router.push(`?range=${range}`);
  };

  return (
    <div>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Business Overview</h1>
          <p>Real-time insights into your inventory and deliveries</p>
        </div>
        <div>
          <select 
            value={currentRange} 
            onChange={handleRangeChange}
            className={styles.inputField}
            style={{ width: 'auto', fontWeight: 600 }}
          >
            <option value="week">Past Week</option>
            <option value="month">Past Month</option>
            <option value="year">Past Year</option>
          </select>
        </div>
      </div>
      
      {/* High-Level Stats Cards */}
      <div className={styles.grid}>
        <div className={styles.card} style={{ borderLeft: '4px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Deliveries</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.activeDeliveries}</p>
          </div>
          <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '12px', color: '#3b82f6' }}>
            <Truck size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #10b981', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Completed</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.completedDeliveries}</p>
          </div>
          <div style={{ backgroundColor: '#ecfdf5', padding: '16px', borderRadius: '12px', color: '#10b981' }}>
            <CheckCircle size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Low Stock Items</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.lowStockItems}</p>
          </div>
          <div style={{ backgroundColor: '#fef2f2', padding: '16px', borderRadius: '12px', color: '#ef4444' }}>
            <AlertTriangle size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #8b5cf6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Products</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.totalProducts}</p>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '16px', borderRadius: '12px', color: '#8b5cf6' }}>
            <Package size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #0ea5e9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Customers</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.activeCustomers || 0}</p>
          </div>
          <div style={{ backgroundColor: '#e0f2fe', padding: '16px', borderRadius: '12px', color: '#0ea5e9' }}>
            <Users size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #f97316', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring Licenses</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.expiringLicenses || 0}</p>
          </div>
          <div style={{ backgroundColor: '#ffedd5', padding: '16px', borderRadius: '12px', color: '#f97316' }}>
            <CreditCard size={28} />
          </div>
        </div>

        <div className={styles.card} style={{ borderLeft: '4px solid #eab308', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring Registrations</h3>
            <p style={{ color: '#1e293b', fontSize: '32px', margin: '8px 0 0 0' }}>{initialStats.expiringRegistrations || 0}</p>
          </div>
          <div style={{ backgroundColor: '#fef9c3', padding: '16px', borderRadius: '12px', color: '#eab308' }}>
            <Car size={28} />
          </div>
        </div>
      </div>

      <DashboardCharts initialChartData={initialChartData} />
    </div>
  );
}
