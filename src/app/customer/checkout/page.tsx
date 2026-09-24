'use client';
import { formatCurrency } from '@/lib/formatCurrency';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Truck, ChevronRight, CheckCircle2, ShieldCheck, AlertCircle, Minus, Plus, Trash2 } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const [address, setAddress] = useState('John Doe | (+63) 912 345 6789\n123 Main Street, Brgy. San Jose, Manila City');
  const [priority, setPriority] = useState('STANDARD');
  const [urgentReason, setUrgentReason] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [pickupLocation, setPickupLocation] = useState('Business Location(s)');
  const [loading, setLoading] = useState(false);
  
  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  
  const [rates, setRates] = useState<any[]>([]);
  const [selectedRate, setSelectedRate] = useState<any>(null);
  const [globalUrgentFee, setGlobalUrgentFee] = useState(0);

  useEffect(() => {
    const fetchCart = async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (!user || !user.id) return;
        
        const tempCheckout = sessionStorage.getItem('temp_checkout');
        if (tempCheckout) {
          setItems(JSON.parse(tempCheckout));
        } else {
          const res = await fetch(`/api/cart?customerId=${user.id}`);
          if (res.ok) {
            const data = await res.json();
            setItems(data);
          }
        }
        
        const ratesRes = await fetch('/api/vehicle-rates');
        if (ratesRes.ok) {
          const rData = await ratesRes.json();
          if (rData.platformSettings) { setGlobalUrgentFee(Number(rData.platformSettings.urgentDeliveryFee || 0)); }
          setRates(rData.data || []);
          if (rData.data && rData.data.length > 0) {
            setSelectedRate(rData.data.find((r: any) => r.vehicleType.toLowerCase() === 'motorcycle') || rData.data[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingItems(false);
      }
    };
    fetchCart();
  }, []);

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const updateQuantity = (id: number, delta: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const setQuantityExact = (id: number, qty: number) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, quantity: Math.max(1, qty) };
      }
      return item;
    }));
  };
  
  const itemsSubtotal = items.reduce((sum, item) => sum + (Number(item.sellingUnit?.price ?? item.product.price) * item.quantity), 0);
  const normalFee = selectedRate ? Number(selectedRate.basePrice || 0) : 50.00;
  const urgentFee = priority === 'URGENT' ? globalUrgentFee : 0;
  const shippingFee = normalFee + urgentFee;
  const grandTotal = itemsSubtotal + shippingFee;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) {
      alert('Please enter a drop-off location.');
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
        unit: item.product.unit || 'piece',
        productName: `${item.product.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product.name}${item.sellingUnit?.name ? ` - ${item.sellingUnit.name}` : ''}`
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          addressText: address, // Drop-off location
          pickupLocation,
          deliveryDate,
          deliveryPriority: priority,
          urgentReason: priority === 'URGENT' ? urgentReason : null,
          normalDeliveryFee: normalFee,
          urgentAdditionalFee: urgentFee,
          checkoutItems
        })
      });

      if (res.ok) {
        sessionStorage.removeItem('temp_checkout'); // Clear temp cart if it existed
        alert('Order placed successfully!');
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

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '120px' }}>
      


      <div style={{ width: '100%', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
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
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {priority === 'URGENT' && (
              <div>
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
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Pickup Location</label>
              <input 
                type="text"
                value={pickupLocation}
                onChange={e => setPickupLocation(e.target.value)}
                placeholder="e.g. Store Location"
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', color: '#0f172a', fontWeight: 600, fontSize: '15px' }}
              />
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>Drop-off Location *</label>
            <input 
              type="text"
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 123 Main Street"
              style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', outline: 'none', color: '#0f172a', fontWeight: 600, fontSize: '15px' }}
            />
          </div>
        </div>

                {/* Order Summary */}
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
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#f8fafc', padding: '12px 16px', borderRadius: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', lineHeight: 1.3, margin: 0 }}>
                      {item.sellingUnit?.name || 'Piece'} ({item.product.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product.name})
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '15px', minWidth: '80px', textAlign: 'right' }}>
                      ₱{formatCurrency(item.sellingUnit?.price ?? item.product.price)}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '999px', border: '1px solid #e2e8f0', padding: '2px' }}>
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={14} /></button>
                        <input 
                          type="number" 
                          min="1" 
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (!isNaN(val) && val > 0) setQuantityExact(item.id, val);
                          }}
                          onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value) < 1) setQuantityExact(item.id, 1);
                          }}
                          style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', width: '40px', textAlign: 'center', border: 'none', outline: 'none', background: 'transparent' }}
                        />
                        <button type="button" onClick={() => updateQuantity(item.id, 1)} style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={14} /></button>
                      </div>
                      <button type="button" onClick={() => removeItem(item.id)} style={{ color: '#94a3b8', background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'} onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}>
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ textAlign: 'right', fontSize: '14px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #f1f5f9', color: '#64748b', fontWeight: 600 }}>
            Order Total ({items.length} items): <span style={{ color: '#4f46e5', fontSize: '18px', fontWeight: 800, marginLeft: '8px' }}>₱{itemsSubtotal.toFixed(2)}</span>
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
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px', borderBottom: '1px solid #e2e8f0', cursor: 'pointer', background: priority === 'STANDARD' ? '#eef2ff' : 'transparent', transition: 'background 0.2s' }}>
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'STANDARD' ? '2px solid #4f46e5' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'STANDARD' && <div style={{ width: '10px', height: '10px', background: '#4f46e5', borderRadius: '50%' }}></div>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Not Urgent (Standard)</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>TBD</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Normal delivery rate will be determined by partner.</p>
              </div>
            </label>

            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px', cursor: 'pointer', background: priority === 'URGENT' ? '#fff1f2' : 'transparent', transition: 'background 0.2s' }}>
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'URGENT' ? '2px solid #ef4444' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'URGENT' && <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }}></div>}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}><AlertCircle size={16}/> Urgent Delivery</span>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>+₱{(selectedRate?.urgentAdditionalFee || 0)}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#64748b' }}>Additional fee applied for urgent processing.</p>
                

              </div>
            </label>
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
              <span style={{ color: '#0f172a' }}>₱{itemsSubtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Normal Delivery Fee</span>
              <span style={{ color: '#0f172a' }}>₱{normalFee.toFixed(2)}</span>
            </div>
            {priority === 'URGENT' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Urgent Additional Fee</span>
                <span style={{ color: '#ef4444' }}>₱{urgentFee.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #f1f5f9', paddingTop: '12px', marginTop: '12px' }}>
              <span style={{ fontWeight: 700, color: '#0f172a' }}>Total Delivery Fee</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>
                {priority === 'URGENT' ? `₱${urgentFee.toFixed(2)} + TBD` : 'TBD'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, color: '#0f172a', fontSize: '16px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
              <span>Total Payment</span>
              <span style={{ color: '#4f46e5', fontSize: '18px' }}>
                ₱{(itemsSubtotal + (priority === 'URGENT' ? urgentFee : 0)).toFixed(2)} + TBD
              </span>
            </div>
            </div>
            
            <button 
              onClick={handleCheckout}
              disabled={loading}
              style={{
                marginTop: '16px',
                background: loading ? '#94a3b8' : '#4f46e5',
                color: '#fff',
                fontWeight: 700,
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                width: '100%',
                transition: 'background 0.2s',
                opacity: loading ? 0.7 : 1
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = '#4338ca' }}
              onMouseLeave={(e) => { if (!loading) e.currentTarget.style.background = '#4f46e5' }}
            >
              {loading ? 'Processing...' : 'Place Order'}
            </button>
              </div>
  </div>
</div>
  );
}
