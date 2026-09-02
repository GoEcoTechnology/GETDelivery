import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers, deliveryItems, products } from '@/db/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import OrdersTableClient from './OrdersTableClient';
import styles from '../partner.module.css';

export const metadata = {
  title: 'My Orders | GET Delivery Partner',
};

export default async function PartnerOrdersPage() {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER') {
    redirect('/login');
  }

  const partnerId = parseInt(partnerIdStr, 10);

  // Fetch all invitations for this partner, joined with order details
  const invitations = await db
    .select({
      invitation: deliveryInvitations,
      order: deliveryOrders,
      tenant: tenants,
      customer: customers
    })
    .from(deliveryInvitations)
    .innerJoin(deliveryOrders, eq(deliveryInvitations.deliveryOrderId, deliveryOrders.id))
    .innerJoin(tenants, eq(deliveryInvitations.tenantId, tenants.id))
    .leftJoin(customers, eq(deliveryOrders.customerId, customers.id))
    .where(eq(deliveryInvitations.deliveryPartnerId, partnerId))
    .orderBy(desc(deliveryInvitations.createdAt));

  const orderIds = invitations.map(i => i.order.id);
  
  const items = orderIds.length > 0 ? await db.select({
      deliveryOrderId: deliveryItems.deliveryOrderId,
      quantity: deliveryItems.quantity,
      unit: deliveryItems.unit,
      productName: products.name
  })
  .from(deliveryItems)
  .innerJoin(products, eq(deliveryItems.productId, products.id))
  .where(inArray(deliveryItems.deliveryOrderId, orderIds)) : [];

  const invitationsWithItems = invitations.map((inv) => ({
     ...inv,
     items: items
       .filter((i) => i.deliveryOrderId === inv.order.id)
       .map((i) => ({ ...i, unit: i.unit ?? 'pcs' }))
  })) as Array<{
    invitation: { id: number; createdAt: Date | string; status: string };
    order: { id: number; dropoffAddress: string; instructions?: string; preferredVehicle?: string; finalDeliveryPrice?: string | number; requiredVehicleType?: string; distanceKm?: string | number; vehicleBasePrice?: string | number; pricePerKm?: string | number; pickupAddress?: string };
    tenant: { name: string };
    customer?: { name: string; mobileNumber?: string | null } | null;
    items: Array<{ deliveryOrderId: number; quantity: number; unit: string; productName: string }>;
  }>;

  return (
    <div style={{ paddingBottom: '64px' }}>
      <div className={styles.flexBetween} style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>Delivery Inbox</h1>
      </div>

      <OrdersTableClient invitations={invitationsWithItems} />
    </div>
  );
}
