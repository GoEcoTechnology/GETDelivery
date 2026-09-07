import { db } from '@/db';
import { deliveryOrders, tenants, customers, deliveryPartners } from '@/db/schema';
import { eq } from 'drizzle-orm';

export type StandardNotificationParams = {
  orderId: number;
  status: string;
  reason?: string;
};

export async function buildStandardNotificationBody(
  title: string,
  params: StandardNotificationParams
): Promise<string> {
  const [data] = await db.select({
    order: deliveryOrders,
    tenant: tenants,
    customer: customers,
    partner: deliveryPartners,
  })
    .from(deliveryOrders)
    .innerJoin(tenants, eq(deliveryOrders.tenantId, tenants.id))
    .leftJoin(customers, eq(deliveryOrders.customerId, customers.id))
    .leftJoin(deliveryPartners, eq(deliveryOrders.temporaryWinnerId, deliveryPartners.id))
    .where(eq(deliveryOrders.id, params.orderId));

  if (!data) {
    return `${title}\nOrder ID: #${params.orderId}\nStatus: ${params.status.replace(/_/g, ' ')}${params.reason ? `\nReason: ${params.reason}` : ''}`;
  }

  const { order, tenant } = data;

  const parts = [];
  parts.push(`Delivery for ${tenant.name}`);
  parts.push(`Pickup: ${order.pickupAddress}`);
  parts.push(`Drop-off: ${order.dropoffAddress}`);
  
  if (order.deliveryDate) {
    const dDate = new Date(order.deliveryDate);
    const dateStr = dDate.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = order.deliveryTime ? ` ${order.deliveryTime}` : '';
    parts.push(`Delivery Date: ${dateStr}${timeStr}`);
  }
  
  if (params.reason) {
    parts.push(`Reason: ${params.reason}`);
  }

  return parts.join('\n');
}
