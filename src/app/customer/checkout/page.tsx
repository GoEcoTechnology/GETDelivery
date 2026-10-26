'use client';
import { formatCurrency } from '@/lib/formatCurrency';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MapPin,
  Truck,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  Minus,
  Plus,
  Trash2,
  Scale,
  Hash,
  Navigation,
  CheckCircle2,
  Edit2,
  Loader2
} from 'lucide-react';
import MapPicker from '@/components/MapPicker';

export default function CheckoutPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [dropoffLat, setDropoffLat] = useState<number | null>(null);
  const [dropoffLng, setDropoffLng] = useState<number | null>(null);
  const [landmark, setLandmark] = useState('');
  const [isChangingLocation, setIsChangingLocation] = useState(false);

  const [priority, setPriority] = useState('STANDARD');
  const [urgentReason, setUrgentReason] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // Quote calculation state
  const [quote, setQuote] = useState<any>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [savedLocations, setSavedLocations] = useState<any[]>([]);
  const [saveLocationName, setSaveLocationName] = useState('');
  const [isSavingLocation, setIsSavingLocation] = useState(false);

  const fetchLocations = async (userId: number) => {
    try {
      const res = await fetch(`/api/customer/locations?customerId=${userId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data || []);
        const userKey = `customer_default_location_${userId}`;
        if (json.defaultLocation && json.defaultLocation.lat && json.defaultLocation.lng) {
          setAddress(json.defaultLocation.address);
          setDropoffLat(Number(json.defaultLocation.lat));
          setDropoffLng(Number(json.defaultLocation.lng));
          setLandmark(json.defaultLocation.landmark || '');
          setIsChangingLocation(false);
          localStorage.setItem(userKey, JSON.stringify(json.defaultLocation));
        } else {
          // Current customer has NO default location set!
          setAddress('');
          setDropoffLat(null);
          setDropoffLng(null);
          setLandmark('');
          setIsChangingLocation(true);
          localStorage.removeItem(userKey);
          localStorage.removeItem('customer_default_location');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveLocation = async () => {
    if (!saveLocationName.trim() || !dropoffLat || !dropoffLng) {
      alert('Please select a location on the map and provide a name.');
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
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const json = await res.json();
        setSavedLocations(json.data);
        if (json.defaultLocation) {
          localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(json.defaultLocation));
        }
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
    let currentUserId: number | null = null;
    try {
      const userStr = localStorage.getItem('user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      if (userObj?.id) currentUserId = userObj.id;
    } catch (e) {}

    // Fast initial location retrieval from local storage (strictly scoped to current user)
    const userStorageKey = currentUserId ? `customer_default_location_${currentUserId}` : null;
    const cachedLoc = userStorageKey ? localStorage.getItem(userStorageKey) : null;
    if (cachedLoc) {
      try {
        const parsed = JSON.parse(cachedLoc);
        if (parsed && parsed.lat && parsed.lng && parsed.address) {
          setAddress(parsed.address);
          setDropoffLat(Number(parsed.lat));
          setDropoffLng(Number(parsed.lng));
          setLandmark(parsed.landmark || '');
          setIsChangingLocation(false);
        }
      } catch (e) {
        console.error('Failed to parse cached default location:', e);
      }
    } else {
      // Clear out state so location from another customer is never retained
      setAddress('');
      setDropoffLat(null);
      setDropoffLng(null);
      setLandmark('');
    }

    const fetchCart = async () => {
      try {
        const userStr = localStorage.getItem('user');
        const user = userStr ? JSON.parse(userStr) : null;
        if (!user || !user.id) return;

        fetchLocations(user.id);

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
    setItems(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      })
    );
  };

  // Recalculate quote dynamically
  const recalculateQuote = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    const storeTenantId = items[0]?.product?.tenantId || items[0]?.tenantId;
    if (!storeTenantId) {
      setQuote(null);
      return;
    }

    if (dropoffLat === null || dropoffLng === null) {
      setQuote(null);
      setQuoteError(null);
      return;
    }

    setQuoteLoading(true);
    setQuoteError(null);

    try {
      const checkoutItems = items.map(item => ({
        productId: item.product?.id || item.productId,
        variantId: item.product?.variantId || item.variantId || item.product?.id,
        sellingUnitId: item.sellingUnit?.id || item.sellingUnitId || null,
        quantity: item.quantity,
        unitPrice: Number(item.sellingUnit?.price ?? item.product?.price ?? item.price ?? 0)
      }));

      const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
      const res = await fetch('/api/deliveries/calculate-quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          items: checkoutItems,
          tenantId: Number(storeTenantId),
          dropoffLat,
          dropoffLng,
          priority
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setQuote(null);
        setQuoteError(data.error || 'Unable to calculate vehicle assignment or delivery fee.');
      } else {
        setQuote(data);
        setQuoteError(null);
      }
    } catch (err: any) {
      console.error('Failed to calculate quote:', err);
      setQuote(null);
      setQuoteError('Network error while calculating vehicle assignment and delivery fee.');
    } finally {
      setQuoteLoading(false);
    }
  }, [items, dropoffLat, dropoffLng, priority]);

  useEffect(() => {
    recalculateQuote();
  }, [recalculateQuote]);

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Number(item.sellingUnit?.price ?? item.product?.price ?? 0) * item.quantity,
    0
  );

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || dropoffLat === null || dropoffLng === null) {
      alert('Please select a drop-off location on the map.');
      return;
    }
    if (priority === 'URGENT' && !deliveryDate) {
      alert('Please select a delivery date for urgent delivery.');
      return;
    }
    if (quoteError) {
      alert(quoteError);
      return;
    }
    if (!quote || !quote.success) {
      alert('Delivery quote calculation is not complete.');
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
        productId: item.product?.id || item.productId,
        variantId: item.product?.variantId || item.variantId || item.product?.id,
        price: item.sellingUnit?.price ?? item.product?.price,
        tenantId: item.product?.tenantId || items[0]?.tenantId,
        unit: item.sellingUnit?.name || item.product?.unit || 'piece',
        productName: `${item.product?.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product?.name || 'Item'}${item.sellingUnit?.name ? ` - ${item.sellingUnit.name}` : ''}`
      }));

      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: user.id,
          addressText: address,
          dropoffLat,
          dropoffLng,
          dropoffLandmark: landmark,
          pickupLocation: 'Business Location(s)',
          deliveryDate,
          deliveryPriority: priority,
          urgentReason: priority === 'URGENT' ? urgentReason : null,
          normalDeliveryFee: quote.pricing?.normalDeliveryFee,
          urgentAdditionalFee: quote.pricing?.urgentFee,
          distanceKm: quote.distanceKm,
          checkoutItems
        })
      });

      if (res.ok) {
        if (dropoffLat && dropoffLng) {
          const defaultLoc = {
            locationName: landmark || (address ? address.split(',')[0].trim() : 'Saved Address'),
            address,
            lat: Number(dropoffLat),
            lng: Number(dropoffLng),
            landmark: landmark || '',
            isDefault: true
          };
          localStorage.setItem(`customer_default_location_${user.id}`, JSON.stringify(defaultLoc));
        }
        sessionStorage.removeItem('temp_checkout');
        alert('Order placed successfully!');
        router.push('/customer/orders');
      } else {
        const error = await res.json();
        alert('Failed to place order: ' + (error.error || 'Server error'));
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
      <div style={{ width: '100%', maxWidth: '850px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Delivery Details */}
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4f46e5', fontWeight: 700, fontSize: '18px' }}>
              <MapPin size={20} />
              <span>Delivery Destination</span>
            </div>
            {dropoffLat && dropoffLng && !isChangingLocation && (
              <span
                style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  fontSize: '12px',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <CheckCircle2 size={13} /> Saved Location
              </span>
            )}
          </div>

          {priority === 'URGENT' && (
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: 600, color: '#64748b', marginBottom: '8px' }}>
                Delivery Date *
              </label>
              <input
                type="date"
                required
                value={deliveryDate}
                onChange={e => setDeliveryDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  outline: 'none',
                  color: '#0f172a',
                  fontWeight: 600,
                  fontSize: '15px'
                }}
              />
            </div>
          )}

          {/* Customer has a location set and is not editing: show clear confirmed address card */}
          {dropoffLat && dropoffLng && !isChangingLocation ? (
            <div
              style={{
                background: '#f8fafc',
                borderRadius: '14px',
                border: '1px solid #e2e8f0',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flex: 1 }}>
                  <div
                    style={{
                      background: '#e0e7ff',
                      color: '#4338ca',
                      width: '36px',
                      height: '36px',
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: '2px'
                    }}
                  >
                    <MapPin size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Delivering To (Saved)
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginTop: '2px', lineHeight: 1.4 }}>
                      {address || 'Location Coordinates Selected'}
                    </div>
                    {landmark && (
                      <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Navigation size={13} color="#4f46e5" />
                        <span>Landmark: <strong>{landmark}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsChangingLocation(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    transition: 'all 0.15s'
                  }}
                >
                  <Edit2 size={13} /> Change Location
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* Prompt when location is not yet set */}
              {(!dropoffLat || !dropoffLng) && (
                <div style={{ marginBottom: '14px', background: '#eff6ff', border: '1px solid #bfdbfe', padding: '12px 14px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Navigation size={18} color="#2563eb" />
                  <span style={{ fontSize: '13px', color: '#1e40af', fontWeight: 600 }}>
                    Please set your delivery location on the map below. Once set, future orders will automatically remember this location.
                  </span>
                </div>
              )}

              {savedLocations.length > 0 && (
                <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '8px' }}>
                    Saved Locations:
                  </label>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {savedLocations.map((loc: any, idx: number) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setAddress(loc.address);
                          setDropoffLat(Number(loc.lat));
                          setDropoffLng(Number(loc.lng));
                          setLandmark(loc.landmark || '');
                          setIsChangingLocation(false);
                        }}
                        style={{
                          padding: '8px 14px',
                          background: loc.isDefault ? '#e0e7ff' : 'white',
                          border: loc.isDefault ? '1px solid #818cf8' : '1px solid #cbd5e1',
                          borderRadius: '20px',
                          fontSize: '13px',
                          fontWeight: 600,
                          color: '#0f172a',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {loc.locationName} {loc.isDefault ? '★' : ''}
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
                onLocationSelect={res => {
                  setAddress(res.address);
                  setDropoffLat(res.lat);
                  setDropoffLng(res.lng);
                  if (res.landmark !== undefined) setLandmark(res.landmark);
                }}
              />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
                {dropoffLat && dropoffLng ? (
                  <>
                    <div style={{ display: 'flex', gap: '8px', flex: 1 }}>
                      <input
                        type="text"
                        placeholder="Save location name (e.g. Home, Warehouse)"
                        value={saveLocationName}
                        onChange={e => setSaveLocationName(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: '1px solid #cbd5e1',
                          fontSize: '13px'
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveLocation}
                        disabled={isSavingLocation}
                        style={{
                          padding: '10px 16px',
                          background: '#0f172a',
                          color: 'white',
                          border: 'none',
                          borderRadius: '10px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer'
                        }}
                      >
                        {isSavingLocation ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsChangingLocation(false)}
                      style={{
                        padding: '10px 16px',
                        background: '#4f46e5',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        fontSize: '13px',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      Confirm
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={20} color="#4f46e5" />
              <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>Order Items ({items.length})</span>
            </div>
            {quoteLoading && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#4f46e5', fontWeight: 600 }}>
                <Loader2 size={14} className="animate-spin" /> Calculating vehicle & rate...
              </span>
            )}
          </div>

          {loadingItems ? (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '14px', color: '#64748b' }}>Loading items...</div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '16px', fontSize: '14px', color: '#64748b' }}>No items in checkout.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map(item => {
                const price = Number(item.sellingUnit?.price ?? item.product?.price ?? item.price ?? 0);
                const breakdown = quote?.itemBreakdown?.find(
                  (b: any) =>
                    b.productId === (item.product?.id || item.productId) &&
                    b.variantId === (item.product?.variantId || item.variantId || item.product?.id)
                );
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      border: '1px solid #f1f5f9'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px', margin: '0 0 4px 0' }}>
                        {item.product?.parentName ? `${item.product.parentName} - ${item.product.name}` : item.product?.name || 'Product'}
                        {item.sellingUnit?.name ? ` (${item.sellingUnit.name})` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                        <span>Price: ₱{formatCurrency(price)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#fff', borderRadius: '999px', border: '1px solid #e2e8f0', padding: '2px' }}>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Minus size={14} />
                        </button>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', width: '36px', textAlign: 'center' }}>
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          style={{ width: '28px', height: '28px', borderRadius: '50%', color: '#64748b', background: '#f1f5f9', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span style={{ color: '#0f172a', fontWeight: 800, fontSize: '15px', minWidth: '80px', textAlign: 'right' }}>
                        ₱{formatCurrency(price * item.quantity)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        style={{ color: '#94a3b8', background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery Options */}
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck size={20} color="#4f46e5" />
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>Delivery Priority</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label
              onClick={() => setPriority('STANDARD')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                borderBottom: '1px solid #e2e8f0',
                cursor: 'pointer',
                background: priority === 'STANDARD' ? '#eef2ff' : 'transparent',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'STANDARD' ? '2px solid #4f46e5' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'STANDARD' && <div style={{ width: '10px', height: '10px', background: '#4f46e5', borderRadius: '50%' }} />}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>Standard Delivery</span>
                  {quote?.pricing && (
                    <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '15px' }}>
                      ₱{formatCurrency(quote.pricing.normalDeliveryFee)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Automated dispatch based on weight capacity and distance.
                </p>
              </div>
            </label>

            <label
              onClick={() => setPriority('URGENT')}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                cursor: 'pointer',
                background: priority === 'URGENT' ? '#fff1f2' : 'transparent',
                transition: 'background 0.2s'
              }}
            >
              <div style={{ paddingTop: '2px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: priority === 'URGENT' ? '2px solid #ef4444' : '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {priority === 'URGENT' && <div style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '50%' }} />}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertCircle size={16} /> Urgent Delivery
                  </span>
                  {quote?.pricing && (
                    <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '15px' }}>
                      +₱{formatCurrency(quote.pricing.urgentFee)}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                  Expedited delivery with dedicated vehicle dispatch.
                </p>
              </div>
            </label>
          </div>
        </div>

        {/* Booking Summary Box */}
        <div
          style={{
            background: '#fff',
            borderRadius: '20px',
            border: '1px solid #e2e8f0',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
          }}
        >
          <h3 style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', margin: 0 }}>
            Booking Summary
          </h3>

          {(!dropoffLat || !dropoffLng) && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '14px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <Navigation size={18} color="#16a34a" />
              <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                Select a drop-off location on the map above to view the delivery fee.
              </span>
            </div>
          )}

          {quoteError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '14px', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <AlertTriangle size={20} color="#dc2626" />
              <span style={{ fontSize: '13px', color: '#991b1b', fontWeight: 600 }}>{quoteError}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#64748b', fontWeight: 600 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Product subtotal</span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>₱{formatCurrency(itemsSubtotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Shipping fee</span>
              {quoteLoading ? (
                <span style={{ color: '#4f46e5', fontWeight: 600 }}>Calculating...</span>
              ) : quote?.pricing ? (
                <span style={{ color: '#0f172a', fontWeight: 700 }}>₱{formatCurrency(quote.pricing.totalShippingFee)}</span>
              ) : (
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '13px' }}>Pending destination</span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, color: '#0f172a', fontSize: '18px', marginTop: '6px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1' }}>
              <span>Total payment</span>
              <span style={{ color: '#4f46e5' }}>
                ₱{formatCurrency(quote?.grandTotal ?? itemsSubtotal)}
              </span>
            </div>
          </div>

          <button
            onClick={handleCheckout}
            disabled={loading || quoteLoading || !quote || !quote.success || !address || dropoffLat === null || (priority === 'URGENT' && !deliveryDate)}
            style={{
              marginTop: '12px',
              background:
                loading || quoteLoading || !quote || !quote.success || !address || dropoffLat === null || (priority === 'URGENT' && !deliveryDate)
                  ? '#94a3b8'
                  : '#4f46e5',
              color: '#fff',
              fontWeight: 800,
              padding: '16px',
              borderRadius: '14px',
              border: 'none',
              cursor:
                loading || quoteLoading || !quote || !quote.success || !address || dropoffLat === null || (priority === 'URGENT' && !deliveryDate)
                  ? 'not-allowed'
                  : 'pointer',
              fontSize: '16px',
              width: '100%',
              transition: 'background 0.2s',
              boxShadow: '0 10px 15px -3px rgba(79, 70, 229, 0.3)'
            }}
          >
            {loading ? 'Processing...' : quote?.grandTotal ? `Confirm Booking & Pay ₱${formatCurrency(quote.grandTotal)}` : 'Place Order'}
          </button>
        </div>
      </div>
    </div>
  );
}
