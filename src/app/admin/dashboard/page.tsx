import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import styles from '../admin.module.css';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  const { range: rangeParam } = await searchParams;
  const range = rangeParam || 'month';

  return <DashboardClient currentRange={range} />;
}
