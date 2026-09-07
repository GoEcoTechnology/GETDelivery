import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers, deliveryItems, products } from '@/db/schema';
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
        dropoffAddress: deliveryOrders.dropoffAddress,
        instructions: deliveryOrders.instructions,
        preferredVehicle: deliveryOrders.preferredVehicle,
        finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
        requiredVehicleType: deliveryOrders.requiredVehicleType,
        distanceKm: deliveryOrders.distanceKm,
        vehicleBasePrice: deliveryOrders.vehicleBasePrice,
        pricePerKm: deliveryOrders.pricePerKm,
        pickupAddress: deliveryOrders.pickupAddress
      },
      tenant: {
        name: tenants.name
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

  const invitationsWithItems = invitations as Array<{
    invitation: { id: number; createdAt: Date | string; status: string };
    order: { id: number; dropoffAddress: string; instructions?: string; preferredVehicle?: string; finalDeliveryPrice?: string | number; requiredVehicleType?: string; distanceKm?: string | number; vehicleBasePrice?: string | number; pricePerKm?: string | number; pickupAddress?: string };
    tenant: { name: string };
    customer?: { name: string; mobileNumber?: string | null } | null;
  }>;

  return (
    <div style={{ paddingBottom: '64px' }}>

      <OrdersTableClient invitations={invitationsWithItems} partnerCompanyName={partner?.companyName || 'You'} />
    </div>
  );
}
