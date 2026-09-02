import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VehiclesClient from './VehiclesClient';

export default async function VehiclesPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  return <VehiclesClient />;
}
