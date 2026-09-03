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

  const { order, tenant, customer, partner } = data;

  const parts = [];
  parts.push(`Order ID: #${order.id}`);
  parts.push(`Business Owner: ${tenant.name}`);
  if (partner) {
    parts.push(`Delivery Partner: ${partner.companyName || partner.contactPerson || 'Assigned'}`);
  }
  parts.push(`Customer: ${customer ? customer.name : 'Unknown'}`);
  parts.push(`Pickup: ${order.pickupAddress}`);
  parts.push(`Delivery: ${order.dropoffAddress}`);
  
  if (order.deliveryDate) {
    const dDate = new Date(order.deliveryDate);
    const dateStr = dDate.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = order.deliveryTime ? ` ${order.deliveryTime}` : '';
    parts.push(`Delivery Date: ${dateStr}${timeStr}`);
  }
  
  parts.push(`Status: ${params.status.replace(/_/g, ' ')}`);
  
  if (params.reason) {
    parts.push(`Reason: ${params.reason}`);
  }

  return parts.join('\n');
}
