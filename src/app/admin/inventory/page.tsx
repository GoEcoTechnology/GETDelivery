import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';

export default async function InventoryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  return <InventoryClient />;
}
