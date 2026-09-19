import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, deliveryBatches, deliveryBatchItems, tenants, customers, deliveryItems, products, users } from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import PartnerOrderActions from './PartnerOrderActions';
import RouteMap from '@/components/RouteMap';
import { MapPin, User, Package, Navigation, Users, ListOrdered } from 'lucide-react';
import styles from '../../partner.module.css';

function formatCurrency(value: string | number) {
  const num = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(num)) return '-';
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(num);
}

async function getAddressFromCoords(lat: string, lng: string, fallback: string): Promise<string> {
  // OpenStreetMap Nominatim often returns incorrect or distant road names (e.g. Sorsogon-Bacon-Manito Road)
  // for these coordinates. We'll show a friendly fallback instead.
  return 'Location Pinned on Map';
}

function DetailRow({ label, value, chip = false, boldValue = false, color }: { label: string; value: string; chip?: boolean; boldValue?: boolean; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start' }}>
      <span style={{ color: '#64748b', fontSize: '13px', fontWeight: 600 }}>{label}</span>
      <span style={{ 
        fontWeight: boldValue || chip ? 700 : 500, 
        color: color || (chip ? '#4338ca' : '#0f172a'), 
        background: chip ? '#e0e7ff' : 'transparent', 
        padding: chip ? '4px 8px' : 0, 
        borderRadius: chip ? '8px' : 0,
        textAlign: 'right',
        wordBreak: 'break-word',
        lineHeight: 1.5
      }}>{value}</span>
    </div>
  );
}

export default async function PartnerOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const headersList = await headers();
  const partnerIdStr = headersList.get('x-partner-id');
  const role = headersList.get('x-user-role');
  const orderId = parseInt((await params).id, 10);

  if (!partnerIdStr || role !== 'DELIVERY_PARTNER' || isNaN(orderId)) redirect('/login');
  const partnerId = parseInt(partnerIdStr, 10);

  // 1. Fetch initial invitation & order to determine if it's a batch
  const [invitation] = await db.select({ 
    invitation: { status: deliveryInvitations.status },
    order: {
      id: deliveryOrders.id,
      batchId: deliveryOrders.batchId,
      status: deliveryOrders.status,
      deliveryDate: deliveryOrders.deliveryDate,
      pickupAddress: deliveryOrders.pickupAddress,
      requiredVehicleType: deliveryOrders.requiredVehicleType,
      partnerDriverName: deliveryOrders.partnerDriverName,
      partnerDriverContact: deliveryOrders.partnerDriverContact,
      pickupLat: deliveryOrders.pickupLat,
      pickupLng: deliveryOrders.pickupLng,
      instructions: deliveryOrders.instructions
    },
    tenant: {
      id: tenants.id,
      name: tenants.name,
      contactPerson: tenants.contactPerson,
      address: tenants.address,
      lat: tenants.lat,
      lng: tenants.lng,
    }
  })
  .from(deliveryInvitations)
  .innerJoin(deliveryOrders, eq(deliveryInvitations.deliveryOrderId, deliveryOrders.id))
  .innerJoin(tenants, eq(deliveryInvitations.tenantId, tenants.id))
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

  const { order: baseOrder, tenant, invitation: invite } = invitation;
  const isBatch = !!baseOrder.batchId;

  // 2. Fetch all orders for this delivery (either 1 or N if batch)
  let allOrders: any[] = [];
  if (isBatch) {
    const bItems = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, baseOrder.batchId as number));
    const batchOrderIds = bItems.map(i => i.customerOrderId);
    if (batchOrderIds.length > 0) {
      allOrders = await db.select().from(deliveryOrders).where(inArray(deliveryOrders.id, batchOrderIds));
    }
  } else {
    allOrders = await db.select().from(deliveryOrders).where(eq(deliveryOrders.id, baseOrder.id));
  }

  // 3. Aggregate totals and Customer Stops
  let totalPieces = 0;
  let totalCases = 0;
  let totalBottles = 0;
  let totalQuantity = 0;
  let totalWeightKg = 0;
  let totalItemsCount = 0;
  let totalOrderAmount = 0;
  let totalDeliveryFee = 0;
  let totalUrgentFee = 0;
  let grandTotal = 0;
  let distanceKm = 0;

  const customerStops = [];

  for (let i = 0; i < allOrders.length; i++) {
    const o = allOrders[i];
    let customerName = o.customerName;
    let contactNumber = o.customerContact || '';
    let address = o.dropoffAddress || '';

    if (o.customerId) {
      const [cust] = await db.select().from(customers).where(eq(customers.id, o.customerId));
      if (cust) {
        customerName = cust.name;
        contactNumber = cust.mobileNumber || contactNumber;
        address = cust.address || address;
      }
    }

    if (address && /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(address.trim())) {
      const [lat, lng] = address.split(',');
      address = await getAddressFromCoords(lat.trim(), lng.trim(), address);
    }

    const items = await db.select({ 
      id: deliveryItems.id, 
      quantity: deliveryItems.quantity,
      unit: deliveryItems.unit, 
      productName: deliveryItems.productName,
      unitPrice: deliveryItems.unitPrice
    })
    .from(deliveryItems)
    .where(eq(deliveryItems.deliveryOrderId, o.id));

    const mappedProducts = items.map((item) => {
      const qty = item.quantity || 0;
      const unit = (item.unit || '').toLowerCase();
      totalQuantity += qty;
      totalItemsCount++;
      const itemWeight = 0; // TBD from DB if available
      
      if (unit.includes('case')) totalCases += qty;
      else if (unit.includes('bottle')) totalBottles += qty;
      else totalPieces += qty;

      totalOrderAmount += (Number(item.unitPrice) || 0) * qty;

      return {
        name: item.productName || 'Unknown Product',
        unit: item.unit || 'pc',
        quantity: qty,
        weightKg: itemWeight
      };
    });

    totalDeliveryFee += Number(o.normalDeliveryFee || o.vehicleBasePrice) || 0;
    totalUrgentFee += Number(o.urgentAdditionalFee) || 0;
    distanceKm += Number.parseFloat(String(o.distanceKm || o.routeDistance || '0').replace(/[^\d.]/g, '')) || 0;

    customerStops.push({
      stopNumber: i + 1,
      orderId: o.id,
      fullName: customerName,
      contactNumber,
      address,
      lat: o.dropoffLat,
      lng: o.dropoffLng,
      products: mappedProducts,
      instructions: o.instructions,
      status: o.status
    });
  }

  grandTotal = totalDeliveryFee + totalUrgentFee + totalOrderAmount;

  const [businessOwner] = await db.select({ name: users.name, contactNumber: users.contactNumber, email: users.email })
    .from(users)
    .where(and(eq(users.tenantId, tenant.id), eq(users.role, 'BUSINESS_OWNER')))
    .limit(1);

  return (
    <div style={{ display: 'grid', gap: '16px', minHeight: 'calc(100vh - 140px)', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Delivery Assignment</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px', alignItems: 'start' }}>
        {/* LEFT COLUMN: Map & Customer Manifest */}
        <div style={{ display: 'grid', gap: '16px' }}>
          
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Navigation size={20} color="#4f46e5" /> Route Map</h3></div>
            <div className={styles.cardContent} style={{ padding: 0 }}>
              <div style={{ height: '300px' }}>
                <RouteMap 
                  pickupAddress={isBatch && tenant.address ? tenant.address : baseOrder.pickupAddress} 
                  pickupLat={isBatch && tenant.lat ? parseFloat(tenant.lat as any) : (baseOrder.pickupLat ? parseFloat(baseOrder.pickupLat) : undefined)} 
                  pickupLng={isBatch && tenant.lng ? parseFloat(tenant.lng as any) : (baseOrder.pickupLng ? parseFloat(baseOrder.pickupLng) : undefined)} 
                  customerStops={customerStops.map(stop => ({
                    id: stop.orderId,
                    stopNumber: stop.stopNumber,
                    address: stop.address,
                    lat: stop.lat ? parseFloat(stop.lat) : undefined,
                    lng: stop.lng ? parseFloat(stop.lng) : undefined,
                    customerName: stop.fullName,
                    contactNumber: stop.contactNumber
                  }))}
                  showCurrentLocation={true}
                />
              </div>
            </div>
          </section>

          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="#4f46e5" /> Customer Stops ({customerStops.length})
              </h3>
            </div>
            <div className={styles.cardContent} style={{ display: 'grid', gap: '16px' }}>
              {customerStops.map((stop) => (
                <div key={stop.stopNumber} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ background: '#4f46e5', color: 'white', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', fontSize: '12px' }}>{stop.stopNumber}</span>
                      {stop.fullName}
                    </div>
                    {stop.contactNumber && (
                      <a href={`tel:${stop.contactNumber}`} style={{ color: '#4f46e5', fontSize: '13px', fontWeight: 600, textDecoration: 'none' }}>
                        {stop.contactNumber}
                      </a>
                    )}
                  </div>
                  <div style={{ padding: '16px', display: 'grid', gap: '12px' }}>
                    <DetailRow label="Address" value={stop.address} />
                    
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>Products</div>
                      <div style={{ display: 'grid', gap: '4px' }}>
                        {stop.products.map((p, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#334155', padding: '6px 8px', background: '#f1f5f9', borderRadius: '6px' }}>
                            <span>{p.name}</span>
                            <span style={{ fontWeight: 600 }}>x{p.quantity} {p.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {stop.instructions && (
                      <div style={{ marginTop: '12px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', padding: '10px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, color: '#a16207', fontSize: '12px', whiteSpace: 'nowrap' }}>Landmark:</span>
                        <span style={{ color: '#854d0e', fontSize: '13px', lineHeight: 1.4 }}>{stop.instructions}</span>
                      </div>
                    )}

                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* RIGHT COLUMN: Details & Actions */}
        <div style={{ display: 'grid', gap: '16px' }}>
          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><MapPin size={20} color="#4f46e5" /> Request Actions</h3></div>
            <div className={styles.cardContent}>
              <PartnerOrderActions orderId={baseOrder.id} status={['ACCEPTED', 'TEMPORARY_WINNER'].includes(invite.status) ? baseOrder.status : invite.status} />
            </div>
          </section>

          <section className={styles.card} style={{ marginBottom: 0 }}>
            <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><ListOrdered size={20} color="#4f46e5" /> Delivery Summary</h3></div>
            <div className={styles.cardContent} style={{ display: 'grid', gap: '12px' }}>
              {(() => {
                const resolvedStatus = ['ACCEPTED', 'TEMPORARY_WINNER'].includes(invite.status) ? baseOrder.status : invite.status;
                let displayStatus = resolvedStatus === 'TEMPORARY_WINNER' ? 'ASSIGNED' : resolvedStatus.replace(/_/g, ' ');
                if (resolvedStatus === 'IN_TRANSIT') displayStatus = 'IN TRANSIT';
                if (resolvedStatus === 'WAITING_FOR_PARTNER') displayStatus = 'AVAILABLE';
                if (resolvedStatus === 'ACCEPTED') displayStatus = 'ACCEPTED';
                return <DetailRow label="Status" value={displayStatus} chip />;
              })()}
              
              <DetailRow label="Scheduled Date" value={baseOrder.deliveryDate ? new Date(baseOrder.deliveryDate).toLocaleDateString() : 'ASAP'} />
              
              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
              
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Pickup Information</div>
              {await (async () => {
                let pickupAddress = (isBatch && tenant.address ? tenant.address : baseOrder.pickupAddress) || '';
                let pickupNote = '';
                const match = pickupAddress.match(/\(([^)]+)\)$/);
                if (match) {
                  pickupNote = match[1];
                  pickupAddress = pickupAddress.replace(/\s*\([^)]+\)$/, '');
                }
                
                if (pickupAddress && /^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?$/.test(pickupAddress.trim())) {
                  const [lat, lng] = pickupAddress.split(',');
                  pickupAddress = await getAddressFromCoords(lat.trim(), lng.trim(), pickupAddress);
                }

                return (
                  <>
                    <DetailRow label="Address" value={pickupAddress} />
                    {tenant.name && <DetailRow label="Business" value={tenant.name} />}
                    {businessOwner?.contactNumber && <DetailRow label="Contact" value={businessOwner.contactNumber} />}
                    {pickupNote && (
                      <div style={{ background: '#fffbeb', padding: '8px 12px', borderRadius: '8px', border: '1px solid #fde68a', fontSize: '13px', color: '#b45309', marginTop: '4px' }}>
                        <strong>Landmark:</strong> {pickupNote}
                      </div>
                    )}
                  </>
                );
              })()}
              
              <div style={{ height: '1px', background: '#e2e8f0', margin: '4px 0' }} />
              
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Totals</div>
              <DetailRow label="Total Customers" value={String(customerStops.length)} boldValue />
              <DetailRow label="Total Items" value={String(totalItemsCount)} />
              <DetailRow label="Total Quantity" value={String(totalQuantity)} />
              <DetailRow label="Total Cases / Bottles / Pcs" value={`${totalCases} / ${totalBottles} / ${totalPieces}`} />
              
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '8px' }}>
                <DetailRow label="Order Amount" value={formatCurrency(totalOrderAmount)} />
                <DetailRow label="Delivery Fee" value={formatCurrency(totalDeliveryFee)} color="#16a34a" boldValue />
                {totalUrgentFee > 0 && <DetailRow label="Urgent Fee" value={formatCurrency(totalUrgentFee)} color="#ea580c" />}
                <div style={{ height: '1px', background: '#cbd5e1', margin: '8px 0' }} />
                <DetailRow label="Grand Total" value={formatCurrency(grandTotal)} color="#4f46e5" boldValue />
              </div>

            </div>
          </section>

          {baseOrder.partnerDriverName && (
            <section className={styles.card} style={{ marginBottom: 0 }}>
              <div className={styles.cardHeader}><h3 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><User size={20} color="#4f46e5" /> Assigned Driver</h3></div>
              <div className={styles.cardContent} style={{ display: 'grid', gap: '6px' }}>
                <DetailRow label="Name" value={baseOrder.partnerDriverName} boldValue />
                {baseOrder.partnerDriverContact && <DetailRow label="Contact" value={baseOrder.partnerDriverContact} />}
              </div>
            </section>
          )}
        </div>

      </div>
    </div>
  );
}
