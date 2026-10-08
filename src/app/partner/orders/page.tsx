import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers, deliveryItems, products, deliveryBatchItems } from '@/db/schema';
import { eq, desc, inArray, and, ne, sql, isNull } from 'drizzle-orm';
import { deliveryPartners } from '@/db/schema';
import OrdersTableClient from './OrdersTableClient';
import styles from '../partner.module.css';

export const metadata = {
  title: 'Available Orders | GET Delivery Partner',
};

export default async function PartnerOrdersPage() {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER') {
    redirect('/login');
  }

  const partnerId = parseInt(partnerIdStr, 10);

  const [partner] = await db.select({ companyName: deliveryPartners.companyName })
    .from(deliveryPartners)
    .where(eq(deliveryPartners.id, partnerId));

  // Fetch all invitations for this partner, joined with order details
  const invitations = await db
    .select({
      invitation: {
        id: deliveryInvitations.id,
        createdAt: deliveryInvitations.createdAt,
        status: deliveryInvitations.status
      },
      order: {
        id: deliveryOrders.id,
        status: deliveryOrders.status,
        dropoffAddress: deliveryOrders.dropoffAddress,
        instructions: deliveryOrders.instructions,
        preferredVehicle: deliveryOrders.preferredVehicle,
        finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
        requiredVehicleType: deliveryOrders.requiredVehicleType,
        distanceKm: deliveryOrders.distanceKm,
        vehicleBasePrice: deliveryOrders.vehicleBasePrice,
        pricePerKm: deliveryOrders.pricePerKm,
        pickupAddress: deliveryOrders.pickupAddress,
        batchId: deliveryOrders.batchId,
        orderSource: deliveryOrders.orderSource
      },
      tenant: {
        name: tenants.name,
        address: tenants.address
      },
      customer: {
        name: customers.name,
        mobileNumber: customers.mobileNumber
      }
    })
    .from(deliveryInvitations)
    .innerJoin(deliveryOrders, eq(deliveryInvitations.deliveryOrderId, deliveryOrders.id))
    .innerJoin(tenants, eq(deliveryInvitations.tenantId, tenants.id))
    .leftJoin(customers, eq(deliveryOrders.customerId, customers.id))
    .where(and(
      eq(deliveryInvitations.deliveryPartnerId, partnerId),
      ne(deliveryInvitations.status, 'CANCELLED'),
      isNull(deliveryOrders.temporaryWinnerId)
    ))
    .orderBy(desc(deliveryInvitations.createdAt))
    .limit(100);

  const batchIds = invitations.map(i => i.order.batchId).filter((id): id is number => id !== null);
  const batchItemCounts = new Map<number, number>();
  
  if (batchIds.length > 0) {
    const counts = await db
      .select({
        batchId: deliveryBatchItems.batchId,
        count: sql<number>`count(distinct ${deliveryOrders.dropoffAddress})`
      })
      .from(deliveryBatchItems)
      .leftJoin(deliveryOrders, eq(deliveryBatchItems.customerOrderId, deliveryOrders.id))
      .where(inArray(deliveryBatchItems.batchId, batchIds))
      .groupBy(deliveryBatchItems.batchId);
      
    counts.forEach(c => batchItemCounts.set(c.batchId!, Number(c.count)));
  }

  const manualDeliveryIds = invitations.filter(i => i.order.orderSource === 'CREATED').map(i => i.order.id);
  const manualItemCounts = new Map<number, number>();
  const manualFirstDropoff = new Map<number, string>();
  
  if (manualDeliveryIds.length > 0) {
    const manualChildren = await db
      .select({
        parentId: deliveryOrders.parentOrderId,
        dropoffAddress: deliveryOrders.dropoffAddress
      })
      .from(deliveryOrders)
      .where(inArray(deliveryOrders.parentOrderId, manualDeliveryIds));
      
    manualChildren.forEach(child => {
      if (child.parentId) {
        const count = manualItemCounts.get(child.parentId) || 0;
        manualItemCounts.set(child.parentId, count + 1);
        if (!manualFirstDropoff.has(child.parentId) && child.dropoffAddress) {
          manualFirstDropoff.set(child.parentId, child.dropoffAddress);
        }
      }
    });
  }

  const invitationsWithItems = invitations.map(inv => {
    let batchCustomerCount = 0;
    let explicitDropoff = inv.order.dropoffAddress;

    if (inv.order.batchId) {
      batchCustomerCount = batchItemCounts.get(inv.order.batchId) || 0;
    } else if (inv.order.orderSource === 'CREATED') {
      batchCustomerCount = manualItemCounts.get(inv.order.id) || 0;
      if (batchCustomerCount === 1) {
        explicitDropoff = manualFirstDropoff.get(inv.order.id) || inv.order.dropoffAddress;
      }
    }

    return {
      ...inv,
      order: {
        ...inv.order,
        batchCustomerCount,
        dropoffAddress: explicitDropoff
      }
    };
  }) as Array<{
    invitation: { id: number; createdAt: Date | string; status: string };
    order: { id: number; batchId?: number | null; orderSource?: string; batchCustomerCount?: number; dropoffAddress: string; instructions?: string; preferredVehicle?: string; finalDeliveryPrice?: string | number; requiredVehicleType?: string; distanceKm?: string | number; vehicleBasePrice?: string | number; pricePerKm?: string | number; pickupAddress?: string };
    tenant: { name: string; address?: string | null };
    customer?: { name: string; mobileNumber?: string | null } | null;
  }>;

  return (
    <div style={{ paddingBottom: '64px' }}>

      <OrdersTableClient invitations={invitationsWithItems} partnerCompanyName={partner?.companyName || 'You'} />
    </div>
  );
}
