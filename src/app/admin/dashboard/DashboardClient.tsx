'use client';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import DashboardStats from './DashboardStats';
import DashboardRecentTables from './DashboardRecentTables';
import DashboardChartsContainer from './DashboardChartsContainer';

export default function DashboardClient({ currentRange }: { currentRange: string }) {
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
      </div>

      {/* High-Level Stats Cards - Loads immediately and independently */}
      <DashboardStats />

      {/* Recent Activity Tables - Loads separately without blocking */}
      <DashboardRecentTables />

      {/* Analytics and Charts - Loads last and independently */}
      <DashboardChartsContainer currentRange={currentRange} />
    </div>
  );
}
