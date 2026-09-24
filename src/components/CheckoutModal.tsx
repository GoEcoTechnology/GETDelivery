'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, ChevronRight, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { X } from 'lucide-react';
import MapPicker from '@/components/MapPicker';

export default function CheckoutModal({ isOpen, onClose, tenantId, directItems }: { isOpen: boolean, onClose: () => void, tenantId?: string | null, directItems?: any[] }) {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [landmark, setLandmark] = useState('');
  
  const [priority, setPriority] = useState('STANDARD');
  const [urgentReason, setUrgentReason] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRate, setSelectedRate] = useState<any>(null);

  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [saveLocationName, setSaveLocationName] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const fetchLocations = async (userId: number) => {
    try {
      const res = await fetch(`/api/customer/locations?customerId=${userId}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLocation = async () => {
    if (!saveLocationName.trim() || !dropoffLat || !dropoffLng) {
      alert('Please select a location and provide a name.');
      return;
    }
    
    setIsSavingLocation(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) return;
      
      const payload = {
        customerId: user.id,
        location: {
          locationName: saveLocationName.trim(),
          lat: dropoffLat,
          lng: dropoffLng,
          landmark,
          address
        }
      };
      
      const res = await fetch('/api/customer/locations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data);
        alert('Location saved successfully!');
        setSaveLocationName('');
      } else {
        const err = await res.json();
        alert('Failed to save location: ' + err.error);
      }
    } catch (err) {
      console.error(err);
      alert('Network error while saving location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const fetchCart = async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (!user || !user.id) return;
        
        fetchLocations(user.id);
        
        if (directItems && directItems.length > 0) {
          setItems(directItems);
        } else {
          const res = await fetch(`/api/cart?customerId=${user.id}`);
          if (res.ok) {
            const data = await res.json();
            // Filter items by tenantId if provided
            if (tenantId) {
              setItems(data.filter((item: any) => String(item.product.tenantId) === String(tenantId)));
            } else {
              setItems(data);
            }
          }
        }
        
        const ratesRes = await fetch('/api/vehicle-rates');
        if (ratesRes.ok) {
          const rData = await ratesRes.json();
          setRates(rData.data || []);
          if (rData.data && rData.data.length > 0) {
            const moto = rData.data.find((r: any) => r.vehicleType.toLowerCase().includes('motorcycle'));
            setSelectedRate(moto || null);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchCart();
  }, [isOpen]);
  
  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    return R * c;
  };

  let distanceKm = 0;
  if (dropoffLat !== null && dropoffLng !== null && items.length > 0) {
    const tenantLat = items[0].product?.tenantLat;
    const tenantLng = items[0].product?.tenantLng;
    if (tenantLat !== undefined && tenantLat !== null && tenantLng !== undefined && tenantLng !== null) {
      distanceKm = calculateDistance(Number(tenantLat), Number(tenantLng), dropoffLat, dropoffLng);
    }
  }

  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.sellingUnit?.price ?? item.product?.price) * item.quantity), 0);
  const motorcycleRate = rates.find((r: any) => r.vehicleType.toLowerCase().includes('motorcycle'));
  const basePrice = motorcycleRate ? Number(motorcycleRate.basePrice || 0) : 50.00;
  const pricePerKm = motorcycleRate ? Number(motorcycleRate.pricePerKm || 0) : 10.00;
  
  // Only charge a delivery fee if a valid location is picked
  const normalFee = (dropoffLat !== null && dropoffLng !== null) ? basePrice + (distanceKm * pricePerKm) : 0;
  
  // Urgent fee is a fixed amount across all vehicles, so we can just grab it from the first rate
  const fixedUrgentFee = rates.length > 0 ? Number(rates[0].urgentAdditionalFee || 0) : 0;
  const urgentFee = priority === 'URGENT' ? fixedUrgentFee : 0;
  
  const shippingFee = normalFee + urgentFee;
  const grandTotal = itemsSubtotal + urgentFee;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || dropoffLat === null || dropoffLng === null) {
      alert('Please select a valid drop-off location.');
      return;
    }
    if (priority === 'URGENT' && !deliveryDate) {
      alert('Please select a delivery date for urgent delivery.');
      return;
    }


    setLoading(true);
    try {
      const userStr = localStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      if (!user || !user.id) {
        alert('Please log in first.');
        setLoading(false);
        return;
      }

      const checkoutItems = items.map(item => ({
        cartItemId: item.id || null,
        quantity: item.quantity,
        productId: item.product.id,
        variantId: item.product.variantId || item.product.id,
        price: item.sellingUnit?.price ?? item.product.price,
        tenantId: item.product.tenantId,
        unit: item.sellingUnit?.name || item.sellingUnit?.unitName || item.product.unit || 'piece',
        productName: item.product.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product.name
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          tenantId: tenantId || undefined, // Only checkout items for this store
          addressText: address, // Drop-off location
          dropoffLat,
          dropoffLng,
          dropoffLandmark: landmark,
          pickupLocation: 'Business Location(s)', // Defaulting as removed from UI
          deliveryDate,
          deliveryPriority: priority,
          urgentReason: priority === 'URGENT' ? urgentReason : null,
          normalDeliveryFee: normalFee,
          urgentAdditionalFee: urgentFee,
          checkoutItems
        })
      });

      if (res.ok) {
        alert('Order placed successfully!');
        onClose();
        router.push('/customer/orders');
      } else {
        const error = await res.json();
        alert('Failed to place order: ' + error.error);
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred during checkout.');
    } finally {
      setLoading(false);
    }
  };
  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} onClick={onClose}></div>
      <div style={{ position: 'relative', width: '100%', maxWidth: '1000px', maxHeight: '90vh', overflowY: 'auto', background: '#f8fafc', borderRadius: '24px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800, color: '#0f172a' }}>Secure Checkout</h1>
            <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>Complete your order details below.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '32px' }}>
          {/* Left Column: Delivery & Shipping */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', fontWeight: 700, fontSize: '18px' }}>
            <MapPin size={20} />
            <span>Delivery Details</span>
          </div>
          
          {priority === 'URGENT' && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Delivery Date *</label>
              <input 
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', color: '#0f172a', fontWeight: 600, fontSize: '15px' }}
              />
            </div>
          )}
          
          <div style={{ marginBottom: '8px' }}>
            {savedLocations.length > 0 && (
              <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>Use a Saved Location</label>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                  {savedLocations.map((loc: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAddress(loc.address);
                        setDropoffLat(loc.lat);
                        setDropoffLng(loc.lng);
                        setLandmark(loc.landmark || '');
                      }}
                      style={{ padding: '8px 12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '20px', fontSize: '13px', fontWeight: 600, color: '#0f172a', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      {loc.locationName}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            <MapPicker
              initialLat={dropoffLat || undefined}
              initialLng={dropoffLng || undefined}
              initialAddress={address || undefined}
              initialLandmark={landmark || undefined}
              onLocationSelect={(res) => {
                setAddress(res.address);
                setDropoffLat(res.lat);
                setDropoffLng(res.lng);
                if (res.landmark !== undefined) setLandmark(res.landmark);
              }}
            />
          </div>

        </div>

        </div>

        {/* Right Column: Order Summary & Payment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Order Summary */}
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <ShieldCheck size={20} color="#4f46e5" />
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>Order Summary ({items.length} Items)</span>
          </div>
          
          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '14px', color: '#64748b' }}>Loading items...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '14px', color: '#64748b' }}>No items in checkout.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ paddingRight: '16px' }}>
                    <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', lineHeight: 1.4, margin: '0 0 4px 0' }}>
                      {item.product.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product.name}
                      {item.sellingUnit?.name ? ` - ${item.sellingUnit.name}` : ''}
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Qty: {item.quantity}</p>
                  </div>
                  <div style={{ color: '#0f172a', fontWeight: 800, fontSize: '14px' }}>
                    ₱{Math.round(Number(item.sellingUnit?.price ?? item.product.price))}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginTop: '8px', color: '#64748b', fontWeight: 600 }}>
            <span>Items Subtotal:</span>
            <span style={{ color: '#0f172a', fontWeight: 800 }}>₱{Math.round(itemsSubtotal)}</span>
          </div>
        </div>

        {/* Delivery Options */}
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={20} color="#4f46e5" />
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>Shipping Option</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div 
              onClick={() => setPriority('STANDARD')}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: priority === 'STANDARD' ? '#eef2ff' : 'transparent', transition: 'background 0.2s' }}>
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'STANDARD' ? '2px solid #4f46e5' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'STANDARD' && <div style={{ width: '10px', height: '10px', background: '#4f46e5', borderRadius: '50%' }}></div>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Standard</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>TBD</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Normal delivery rate will be calculated once in transit.</p>
              </div>
            </div>

            <div 
              onClick={() => setPriority('URGENT')}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px', cursor: 'pointer', background: priority === 'URGENT' ? '#fff1f2' : 'transparent', transition: 'background 0.2s' }}>
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'URGENT' ? '2px solid #ef4444' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'URGENT' && <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }}></div>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16}/> Urgent</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>+₱{Math.round(fixedUrgentFee)}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Additional fee applied for urgent processing.</p>
                

              </div>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)'
        }}>
          <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', margin: 0 }}>Payment Details</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Merchandise Subtotal</span>
              <span style={{ color: '#0f172a' }}>₱{Math.round(itemsSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Delivery Fee</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>TBD</span>
            </div>
            {priority === 'URGENT' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Urgent Surcharge</span>
                <span style={{ color: '#ef4444', fontWeight: 700 }}>₱{Math.round(urgentFee)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Total Delivery</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>{priority === 'URGENT' ? `₱${Math.round(urgentFee)} + TBD` : 'TBD'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f172a', fontSize: '18px', marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
              <span>Total Payment</span>
              <span style={{ color: '#4f46e5' }}>₱{Math.round(grandTotal)} + TBD</span>
            </div>
          </div>
        </div>

        <button 
          onClick={handleCheckout}
          disabled={loading}
          style={{
            background: loading ? '#94a3b8' : '#4f46e5',
            color: '#fff',
            fontWeight: 700,
            padding: '16px',
            borderRadius: '16px',
            border: 'none',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            transition: 'background 0.2s',
            boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
          }}
        >
          {loading ? 'Processing...' : 'Place Order Now'}
        </button>

        </div>
      </div>
    </div>
  </div>
  );
}
