import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, tenants, customers, deliveryItems, products, users } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import PartnerOrderActions from './PartnerOrderActions';
import RouteMap from '@/components/RouteMap';
import { MapPin, User, Package, Navigation } from 'lucide-react';
import styles from '../../partner.module.css';

export default async function PartnerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');
  const orderId = parseInt((await params).id, 10);

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER' || isNaN(orderId)) redirect('/login');
  const partnerId = parseInt(partnerIdStr, 10);

  const [invitation] = await db.select({ 
    invitation: {
      status: deliveryInvitations.status,
    },
    order: {
      id: deliveryOrders.id,
      status: deliveryOrders.status,
      deliveryDate: deliveryOrders.deliveryDate,
      pickupAddress: deliveryOrders.pickupAddress,
      dropoffAddress: deliveryOrders.dropoffAddress,
      requiredVehicleType: deliveryOrders.requiredVehicleType,
      vehicleBasePrice: deliveryOrders.vehicleBasePrice,
      pricePerKm: deliveryOrders.pricePerKm,
      distanceKm: deliveryOrders.distanceKm,
      finalDeliveryPrice: deliveryOrders.finalDeliveryPrice,
      partnerDriverName: deliveryOrders.partnerDriverName,
      partnerDriverContact: deliveryOrders.partnerDriverContact,
      pickupLat: deliveryOrders.pickupLat,
      pickupLng: deliveryOrders.pickupLng,
      dropoffLat: deliveryOrders.dropoffLat,
      dropoffLng: deliveryOrders.dropoffLng,
      routePolyline: deliveryOrders.routePolyline,
      instructions: deliveryOrders.instructions
    },
    tenant: {
      id: tenants.id,
      name: tenants.name,
      contactPerson: tenants.contactPerson,
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
    .where(and(eq(deliveryInvitations.deliveryPartnerId, partnerId), eq(deliveryInvitations.deliveryOrderId, orderId)));

  if (!invitation || invitation.invitation.status === 'EXPIRED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 140px)' }}>
        <div style={{ background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15,23,42,0.06)', maxWidth: '400px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>Delivery No Longer Available</h2>
          <p style={{ color: '#475569', marginBottom: '24px', lineHeight: 1.5 }}>This delivery has already been accepted by another Delivery Partner or is no longer available.</p>
          <a href="/partner/orders" style={{ display: 'inline-flex', padding: '12px 24px', background: '#4f46e5', color: 'white', textDecoration: 'none', borderRadius: '12px', fontWeight: 700 }}>
            View Available Deliveries
          </a>
        </div>
      </div>
    );
  }

  const { order, customer, invitation: invite, tenant } = invitation;
  const items = await db.select({ 
    id: deliveryItems.id, 
    quantity: sql<number>`COALESCE((SELECT SUM(quantity_added)::int FROM quota_accumulations WHERE source_order_id = ${order.id} AND product_id = ${deliveryItems.productId}), 0)`.mapWith(Number),
    unit: deliveryItems.unit, 
    productName: products.name 
  })
  .from(deliveryItems)
  .innerJoin(products, eq(deliveryItems.productId, products.id))
  .where(eq(deliveryItems.deliveryOrderId, order.id));

  const [businessOwner] = await db.select({ name: users.name, contactNumber: users.contactNumber, email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.role, 'BUSINESS_OWNER')))
    .limit(1);

  return (
    <div style={{ display: 'grid', gap: '8px', minHeight: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '8px' }}>
      
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px', alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: '8px' }}>
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Navigation size={20} color="#4f46e5" /> Route Map</h3></div>
            <div className={styles.cardContent} style={{ padding: 0 }}>
              <div style={{ height: '180px' }}>
                <RouteMap pickupAddress={order.pickupAddress} dropoffAddress={order.dropoffAddress} pickupLat={order.pickupLat ? parseFloat(order.pickupLat) : undefined} pickupLng={order.pickupLng ? parseFloat(order.pickupLng) : undefined} dropoffLat={order.dropoffLat ? parseFloat(order.dropoffLat) : undefined} dropoffLng={order.dropoffLng ? parseFloat(order.dropoffLng) : undefined} routePolyline={order.routePolyline ?? undefined} />
              </div>
            </div>
          </section>

          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} color="#4f46e5" /> Delivery Details</h3></div>
            <div className={styles.cardContent} style={{ display: 'grid', gap: '12px' }}>
              {(() => {
                const resolvedStatus = ['ACCEPTED', 'TEMPORARY_WINNER'].includes(invite.status) ? order.status : invite.status;
                let displayStatus = resolvedStatus === 'TEMPORARY_WINNER' ? 'ASSIGNED' : resolvedStatus.replace(/_/g, ' ');
                if (resolvedStatus === 'IN_TRANSIT') displayStatus = 'IN TRANSIT';
                if (resolvedStatus === 'DISPATCHED') displayStatus = 'AVAILABLE';
                if (resolvedStatus === 'ASSIGNED') displayStatus = 'ACCEPTED';
                return <DetailRow label="Status" value={displayStatus} chip />;
              })()}
              <DetailRow label="Dropoff" value={order.dropoffAddress} />
              {order.requiredVehicleType && (
                <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Vehicle Required</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px', marginBottom: '4px' }}>{order.requiredVehicleType}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '13px', color: '#475569' }}>
                    {order.vehicleBasePrice && <span>Base Price: <strong style={{ color: '#16a34a' }}>{formatCurrency(order.vehicleBasePrice)}</strong></span>}
                    {order.pricePerKm && <span>Per KM: <strong style={{ color: '#16a34a' }}>₱{Number(order.pricePerKm).toFixed(2)}/km</strong></span>}
                    {order.distanceKm && <span>Distance: <strong style={{ color: '#3b82f6' }}>{Number(order.distanceKm).toFixed(2)} km</strong></span>}
                  </div>
                </div>
              )}
              {order.distanceKm && !order.requiredVehicleType && <DetailRow label="Distance" value={`${order.distanceKm} km`} />}
              {order.deliveryDate && <DetailRow label="Delivery Date" value={new Date(order.deliveryDate).toLocaleDateString()} />}
              {order.finalDeliveryPrice && (
                <div style={{ background: '#ecfdf5', padding: '12px 16px', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                  <div style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' }}>Total Delivery Fee</div>
                  <div style={{ fontWeight: 800, color: '#15803d', fontSize: '20px' }}>{formatCurrency(order.finalDeliveryPrice)}</div>
                  {order.vehicleBasePrice && order.pricePerKm && order.distanceKm && (
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      {formatCurrency(order.vehicleBasePrice)} base + ({Number(order.distanceKm).toFixed(2)} km × ₱{Number(order.pricePerKm).toFixed(2)}/km)
                    </div>
                  )}
                </div>
              )}
              {order.instructions && <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}><div style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Instructions</div><div style={{ color: '#334155' }}>{order.instructions}</div></div>}
            </div>
          </section>
          {order.partnerDriverName && (
            <section className={styles.card} style={{ marginBottom: 0 }}>
              <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={20} color="#4f46e5" /> Assigned Driver</h3></div>
              <div className={styles.cardContent} style={{ display: 'grid', gap: '6px' }}>
                <DetailRow label="Name" value={order.partnerDriverName} />
                {order.partnerDriverContact && <DetailRow label="Contact" value={order.partnerDriverContact} />}
              </div>
            </section>
          )}


        </div>

        <div style={{ display: 'grid', gap: '8px' }}>
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={20} color="#4f46e5" /> Business Owner Information</h3></div>
            <div className={styles.cardContent} style={{ display: 'grid', gap: '6px' }}>
              <DetailRow label="Business Name" value={tenant.name} />
              <DetailRow label="Owner Name" value={businessOwner?.name || tenant.contactPerson || 'Not provided'} />
              <DetailRow label="Contact" value={businessOwner?.contactNumber || 'Not provided'} />
              <DetailRow label="Email" value={businessOwner?.email || 'Not provided'} />
            </div>
          </section>

          {customer && <section className={styles.card} style={{ marginBottom: 0 }}><div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={20} color="#4f46e5" /> Customer Information</h3></div><div className={styles.cardContent} style={{ display: 'grid', gap: '6px' }}><DetailRow label="Name" value={customer.name} /><DetailRow label="Contact" value={customer.mobileNumber || 'Not provided'} /></div></section>}
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Package size={20} color="#4f46e5" /> Items ({items.reduce((sum, item) => sum + item.quantity, 0)})</h3></div>
            <div className={styles.cardContent} style={{ display: 'grid', gap: '6px' }}>
              {items.map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px', borderRadius: '12px', background: '#f8fafc', border: '1px solid #e2e8f0' }}><span>{item.productName}</span><strong>x{item.quantity} {item.unit}</strong></div>)}
              {items.length === 0 && <div style={{ color: '#64748b' }}>No specific items listed.</div>}
            </div>
          </section>
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} color="#4f46e5" /> Request Actions</h3></div>
            <div className={styles.cardContent}><PartnerOrderActions orderId={order.id} status={['ACCEPTED', 'TEMPORARY_WINNER'].includes(invite.status) ? order.status : invite.status} /></div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, chip = false }: { label: string; value: string; chip?: boolean }) {
  return <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}><span style={{ color: '#64748b', fontSize: '13px' }}>{label}</span><span style={{ fontWeight: 700, color: chip ? '#4338ca' : '#0f172a', background: chip ? '#e0e7ff' : 'transparent', padding: chip ? '4px 8px' : 0, borderRadius: chip ? '8px' : 0 }}>{value}</span></div>;
}

function formatCurrency(value: string | number) {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(num);
}
