import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function OrdersRedirectPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  const role = (claims as any).role;
  if (role === 'CUSTOMER') {
    redirect('/customer/orders');
  } else if (role === 'DELIVERY_PARTNER') {
    redirect('/partner/orders');
  } else if (role === 'DRIVER') {
    redirect('/driver');
  } else {
    redirect('/admin/orders');
  }
}
