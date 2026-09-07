import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { Package, Truck, CheckCircle, ClipboardList, Clock3, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { startOfMonth } from 'date-fns';
import { deliveryOrders, tenants } from '@/db/schema';
import DashboardCalendar from './DashboardCalendar';

export const dynamic = 'force-dynamic';

type DeliveryInvitation = {
  id: number;
  status: string;
  updatedAt?: string | Date | null;
  createdAt?: string | Date | null;
  tenantName: string;
  order: {
    id: number;
    deliveryDate: string | Date | null;
    pickupAddress: string;
    dropoffAddress: string;
  }
};

export const metadata = { title: 'Dashboard | GET Delivery Partner' };

export default async function PartnerDashboard() {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');
  if (!partnerIdStr || role !== 'DELIVERY_PARTNER') redirect('/login');

  const partnerId = parseInt(partnerIdStr, 10);
  const monthStart = startOfMonth(new Date());

  const rawInvitations = await db.select({
    invitation: {
      id: deliveryInvitations.id,
      status: deliveryInvitations.status,
      createdAt: deliveryInvitations.createdAt,
    },
    order: {
      id: deliveryOrders.id,
      status: deliveryOrders.status,
      completedAt: deliveryOrders.completedAt,
      deliveryDate: deliveryOrders.deliveryDate,
      pickupAddress: deliveryOrders.pickupAddress,
      dropoffAddress: deliveryOrders.dropoffAddress,
    },
    tenant: {
      name: tenants.name,
    }
  })
    .from(deliveryInvitations)
    .innerJoin(deliveryOrders, eq(deliveryInvitations.deliveryOrderId, deliveryOrders.id))
    .innerJoin(tenants, eq(deliveryInvitations.tenantId, tenants.id))
    .where(eq(deliveryInvitations.deliveryPartnerId, partnerId));

  const invitations: DeliveryInvitation[] = rawInvitations.map((row: any) => ({
    id: row.invitation.id,
    status: ['ACCEPTED', 'TEMPORARY_WINNER'].includes(row.invitation.status) ? row.order.status : row.invitation.status,
    updatedAt: row.order.completedAt || row.invitation.updatedAt,
    createdAt: row.invitation.createdAt,
    tenantName: row.tenant.name,
    order: {
      id: row.order.id,
      deliveryDate: row.order.deliveryDate,
      pickupAddress: row.order.pickupAddress || '',
      dropoffAddress: row.order.dropoffAddress,
      status: row.order.status
    }
  }));

  let newRequests = 0;
  let active = 0;
  let completed = 0;
  invitations.forEach((inv) => {
    const status = inv.status === 'TEMPORARY_WINNER' ? 'ASSIGNED' : inv.status;
    if (status === 'PENDING' || status === 'DISPATCHED') newRequests++;
    else if (status === 'ASSIGNED' || status === 'ACCEPTED' || status === 'IN_TRANSIT') active++;
    else if (inv.status === 'DELIVERED' && new Date(inv.updatedAt || inv.createdAt || 0) >= monthStart) completed++;
  });

  const recentActivity = [...invitations].sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()).slice(0, 5);

  const calendarDeliveries = invitations
    .filter(inv => inv.status === 'ACCEPTED')
    .map(inv => ({
      id: inv.order.id,
      deliveryDate: inv.order.deliveryDate,
      tenantName: inv.tenantName,
      pickupAddress: inv.order.pickupAddress,
      dropoffAddress: inv.order.dropoffAddress
    }));

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <Stat title="New Requests" value={newRequests} icon={<Package size={20} color="#94a3b8" />} />
        <Stat title="Active Deliveries" value={active} icon={<Truck size={20} color="#94a3b8" />} />
        <Stat title="Completed This Month" value={completed} icon={<CheckCircle size={20} color="#94a3b8" />} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '16px' }}>
        <div style={{ minHeight: '400px' }}>
          <DashboardCalendar deliveries={calendarDeliveries} />
        </div>

        <div style={{ display: 'grid', gap: '16px' }}>

          <div style={{ background: 'white', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <Clock3 size={24} color="#0f172a" />
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Recent Activity</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentActivity.length === 0 ? (
                <p style={{ color: '#64748b', margin: 0 }}>No delivery activity yet.</p>
              ) : recentActivity.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '14px 16px', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div>
                    <div style={{ fontWeight: 700, color: '#0f172a' }}>{(item.status === 'TEMPORARY_WINNER' ? 'ASSIGNED' : item.status).replace(/_/g, ' ')}</div>
                    <div style={{ color: '#64748b', fontSize: '13px' }}>Delivery for {item.tenantName}</div>
                  </div>
                  <div style={{ textAlign: 'right', color: '#64748b', fontSize: '12px' }}>{new Date(item.updatedAt || item.createdAt || 0).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)', borderRadius: '18px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: '14px', color: '#64748b', fontWeight: 600, margin: 0 }}>{title}</h3>
        {icon}
      </div>
      <p style={{ color: '#0f172a', fontSize: '32px', fontWeight: 700, margin: 0, lineHeight: 1 }}>{value}</p>
    </div>
  );
}
