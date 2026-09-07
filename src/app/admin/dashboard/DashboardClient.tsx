'use client';
import { useRouter } from 'next/navigation';
import styles from '../admin.module.css';
import DashboardStats from './DashboardStats';
import DashboardRecentTables from './DashboardRecentTables';
import DashboardCalendar from '@/app/partner/dashboard/DashboardCalendar';

type DeliveryItem = {
  id: number;
  deliveryDate: Date | string | null;
  tenantName: string;
  pickupAddress: string;
  dropoffAddress: string;
};

export default function DashboardClient({ currentRange, calendarDeliveries }: { currentRange: string, calendarDeliveries: DeliveryItem[] }) {
  const router = useRouter();

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const range = e.target.value;
    router.push(`?range=${range}`);
  };

  return (
    <div>

      {/* High-Level Stats Cards - Loads immediately and independently */}
      <DashboardStats />

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', marginTop: '32px' }}>
        <div>
          <DashboardCalendar deliveries={calendarDeliveries} />
        </div>
        <div>
          <DashboardRecentTables />
        </div>
      </div>
    </div>
  );
}
