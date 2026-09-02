'use client';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import styles from '../admin.module.css';

const DashboardCharts = dynamic(() => import('./DashboardCharts'), { ssr: false });

export default function DashboardChartsContainer({ currentRange }: { currentRange: string }) {
  const { data: chartData } = useQuery({
    queryKey: ['dashboard-charts', currentRange],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/charts?range=${currentRange}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` } });
      if (!res.ok) throw new Error('Failed to fetch charts');
      return res.json();
    },
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  if (!chartData) return null;

  return (
    <div className={styles.fadeIn}>
      <DashboardCharts initialChartData={chartData} />
    </div>
  );
}
