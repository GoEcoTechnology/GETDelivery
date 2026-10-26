import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import CompletedDeliveriesClient from './CompletedDeliveriesClient';

export const metadata = {
  title: 'Completed Deliveries | GETDelivery',
  description: 'Archive of all fulfilled delivery orders. Records are automatically purged after 30 days — export to Excel to retain data.',
};

export default async function CompletedDeliveriesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) redirect('/login');

  const claims = await verifyToken(token);
  if (!claims) redirect('/login');

  return <CompletedDeliveriesClient />;
}
