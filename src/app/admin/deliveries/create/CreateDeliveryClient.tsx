import { formatCurrency } from '@/lib/formatCurrency';
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import styles from '../../admin.module.css';
import { Plus, Trash2, MapPin, Search, Loader2, Crosshair } from 'lucide-react';

const DeliveryRouteMap = dynamic(() => import('./DeliveryRouteMap'), { ssr: false });

interface Customer {
  id: number;
  name: string;
  mobileNumber: string;
  address: string;
  barangay: string | null;
  municipality: string | null;
}

interface SellingUnit {
  id: number;
  unitName: string;
  price: string | number | null;
  equivalentQty: string | number;
}

interface Variant {
  id: number;
  name: string;
  stock: number;
  unit: string | null;
  price: string | number | null;
  sellingUnits: SellingUnit[];
}

interface Product {
  id: number;
  name: string;
  variants: Variant[];
}

interface LocationPoint {
  id: number;
  label: string; // 'Pickup' | 'Drop-off #1' etc
  address: string;
  lat?: number;
  lng?: number;
  landmark?: string;
  color: string; // marker color hint
}

interface OrderItem {
  productId: string;
  variantId: string;
  sellingUnitId: string;
  quantity: number | '';
}

interface VehicleRate {
  vehicleType: string;
  basePrice: string;
  pricePerKm: string;
}

interface Props {
  customers: Customer[];
  products: Product[];
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

// Search bar for a single location point
function LocationSearchBar({
  label,
  point,
  color,
  onSelect,
  onUseCurrentLocation,
  canRemove,
  onRemove,
}: {
  label: string;
  point: LocationPoint;
  color: string;
  onSelect: (result: { address: string; lat: number; lng: number }) => void;
  onUseCurrentLocation?: () => void;
  canRemove?: boolean;
  onRemove?: () => void;
}) {
  const [searchInput, setSearchInput] = useState(point.address || '');
  const [predictions, setPredictions] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSearchInput(point.address || '');
  }, [point.address]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (!val.trim()) { setPredictions([]); setShowDropdown(false); return; }
    setIsSearching(true);
    setShowDropdown(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(val)}&limit=5&countrycodes=ph`,
          { headers: { 'User-Agent': 'GETDeliveryApp/1.0' } }
        );
        const data = await res.json();
        setPredictions(Array.isArray(data) ? data : []);
      } catch { setPredictions([]); } finally { setIsSearching(false); }
    }, 600);
  };

  const handleSelect = (p: any) => {
    setSearchInput(p.display_name);
    setShowDropdown(false);
    setPredictions([]);
    onSelect({ address: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) });
  };

  return (
    <div style={{ background: '#fff', border: `2px solid ${point.lat ? color : '#e2e8f0'}`, borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MapPin size={16} color={color} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{label}</span>
          {point.lat && <span style={{ fontSize: '11px', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '20px', fontWeight: 700 }}>✓ Located</span>}
        </div>
        {canRemove && onRemove && (
          <button type="button" onClick={onRemove} style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trash2 size={11} /> Remove
          </button>
        )}
      </div>

      <div style={{ position: 'relative' }} ref={dropdownRef}>
        <div style={{ position: 'absolute', top: '50%', left: '12px', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
          {isSearching ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
        </div>
        <input
          type="text"
          placeholder={`Search ${label.toLowerCase()} location...`}
          value={searchInput}
          onChange={handleChange}
          onFocus={() => { if (predictions.length > 0) setShowDropdown(true); }}
          style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
        />
        {showDropdown && predictions.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', maxHeight: '200px', overflowY: 'auto' }}>
            {predictions.map((p, idx) => (
              <div key={idx} onClick={() => handleSelect(p)} style={{ padding: '10px 12px', borderBottom: idx < predictions.length - 1 ? '1px solid #f1f5f9' : 'none', cursor: 'pointer', fontSize: '13px' }}>
                <div style={{ fontWeight: 600, color: '#0f172a' }}>{p.display_name.split(',')[0]}</div>
                <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{p.display_name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {onUseCurrentLocation && (
        <button type="button" onClick={onUseCurrentLocation} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', color: '#334155', fontWeight: 600, cursor: 'pointer', fontSize: '12px' }}>
          <Crosshair size={14} color="#2563eb" /> Use My Current Location
        </button>
      )}

      {point.address && (
        <div style={{ fontSize: '12px', color: '#64748b', padding: '6px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
          📍 {point.address}
        </div>
      )}
    </div>
  );
}

export default function CreateDeliveryClient({ customers, products }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [vehicleRates, setVehicleRates] = useState<VehicleRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<VehicleRate | null>(null);

  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerContact: '',
    routeDistance: '',
    routeDuration: '',
    routePolyline: '',
    deliveryDate: '',
    instructions: '',
    preferredVehicle: '',
  });

  // Single flat list: first is Pickup, rest are Drop-offs
  const [locations, setLocations] = useState<LocationPoint[]>([
    { id: 1, label: 'Pickup', address: '', lat: undefined, lng: undefined, color: '#22c55e' },
    { id: 2, label: 'Drop-off #1', address: '', lat: undefined, lng: undefined, color: '#ef4444' },
  ]);

  const [items, setItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';
    fetch('/api/vehicle-rates', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : { data: [] })
      .then(json => setVehicleRates(json.data || []))
      .catch(() => setVehicleRates([]));
  }, []);

  const distanceKm = (() => {
    if (!formData.routeDistance) return null;
    const str = formData.routeDistance.toLowerCase().trim();
    const m = str.match(/[\d.]+/);
    if (!m) return null;
    const num = parseFloat(m[0]);
    if (str.includes('km')) return num;
    if (str.includes('m')) return num / 1000;
    return num;
  })();

  const deliveryFeeEstimate = selectedRate && distanceKm !== null
    ? Number(selectedRate.basePrice) + distanceKm * Number(selectedRate.pricePerKm)
    : null;

  const handleVehicleChange = (vehicleType: string) => {
    setFormData(prev => ({ ...prev, preferredVehicle: vehicleType }));
    setSelectedRate(vehicleRates.find(r => r.vehicleType === vehicleType) || null);
  };

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const selected = customers.find(c => c.id.toString() === customerId);
    if (selected) {
      const address = [selected.address, selected.barangay, selected.municipality].filter(Boolean).join(', ');
      setFormData(prev => ({ ...prev, customerId: selected.id.toString(), customerName: selected.name, customerContact: selected.mobileNumber }));
      // Pre-fill first drop-off with customer address (no coords yet, user must confirm on map)
      setLocations(prev => prev.map((loc, i) => i === 1 ? { ...loc, address } : loc));
    }
  };

  const updateLocation = (id: number, update: Partial<LocationPoint>) => {
    setLocations(prev => prev.map(loc => loc.id === id ? { ...loc, ...update } : loc));
    setFormData(prev => ({ ...prev, routeDistance: '', routeDuration: '', routePolyline: '' }));
  };

  const handleMapPin = (lat: number, lng: number, pointId: number) => {
    // Called when user clicks on the map — assigns coords to the active point
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'GETDeliveryApp/1.0' }
    })
      .then(r => r.json())
      .then(data => {
        updateLocation(pointId, { lat, lng, address: data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
      })
      .catch(() => updateLocation(pointId, { lat, lng, address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` }));
  };

  const handleCurrentLocation = (id: number) => {
    if (!navigator.geolocation) return alert('Geolocation not supported');
    navigator.geolocation.getCurrentPosition(async pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, { headers: { 'User-Agent': 'GETDeliveryApp/1.0' } }).catch(() => null);
      const data = res ? await res.json().catch(() => null) : null;
      updateLocation(id, { lat, lng, address: data?.display_name || 'My Current Location' });
    }, () => alert('Unable to get location'));
  };

  const addDropoff = () => {
    const dropoffCount = locations.filter(l => l.label !== 'Pickup').length + 1;
    setLocations(prev => [...prev, { id: Date.now(), label: `Drop-off #${dropoffCount}`, address: '', lat: undefined, lng: undefined, color: '#ef4444' }]);
  };

  const removeDropoff = (id: number) => {
    setLocations(prev => {
      const filtered = prev.filter(l => l.id !== id);
      // Re-label drop-offs
      let dropoffIdx = 0;
      return filtered.map(l => l.label === 'Pickup' ? l : { ...l, label: filtered.length === 2 ? 'Drop-off #1' : `Drop-off #${++dropoffIdx}` });
    });
  };

  // --- Item helpers ---
  const handleAddItem = () => setItems([...items, { productId: '', variantId: '', sellingUnitId: '', quantity: 1 }]);
  const handleRemoveItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const handleItemChange = (i: number, field: keyof OrderItem, value: any) => {
    const updated = [...items];
    if (field === 'productId') updated[i] = { ...updated[i], productId: value, variantId: '', sellingUnitId: '' };
    else if (field === 'variantId') updated[i] = { ...updated[i], variantId: value, sellingUnitId: '' };
    else updated[i] = { ...updated[i], [field]: value };
    setItems(updated);
  };

  const getVariants = (productId: string): Variant[] =>
    products.find(p => p.id.toString() === productId)?.variants || [];
  const getSellingUnits = (productId: string, variantId: string): SellingUnit[] =>
    getVariants(productId).find(v => v.id.toString() === variantId)?.sellingUnits || [];
  const getItemPrice = (item: OrderItem): number => {
    const variant = getVariants(item.productId).find(v => v.id.toString() === item.variantId);
    if (item.sellingUnitId) {
      const su = variant?.sellingUnits.find(su => su.id.toString() === item.sellingUnitId);
      if (su?.price) return Number(su.price);
    }
    return variant?.price ? Number(variant.price) : 0;
  };
  const orderTotal = items.reduce((sum, it) => sum + getItemPrice(it) * (Number(it.quantity) || 0), 0);

  const pickup = locations[0];
  const dropoffs = locations.slice(1);
  const primaryDropoff = dropoffs[0];

  const handleRouteCalculated = (data: { distance: string; duration: string; polyline: string }) => {
    setFormData(prev => ({ ...prev, routeDistance: data.distance, routeDuration: data.duration, routePolyline: data.polyline }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { alert('Add at least one item'); return; }
    if (!pickup.lat || !pickup.lng) { alert('Please set the Pickup location'); return; }
    if (dropoffs.some(d => !d.lat || !d.lng)) { alert('Please set all Drop-off locations'); return; }

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const payload = {
        ...formData,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropoffAddress: dropoffs.map(d => d.address).join(' → '),
        dropoffLat: primaryDropoff.lat,
        dropoffLng: primaryDropoff.lng,
        dropoffStops: dropoffs.map(d => ({ address: d.address, lat: d.lat, lng: d.lng, landmark: d.landmark })),
        items: items.map(it => {
          const variant = getVariants(it.productId).find(v => v.id.toString() === it.variantId);
          const su = it.sellingUnitId ? variant?.sellingUnits.find(su => su.id.toString() === it.sellingUnitId) : null;
          return {
            productId: parseInt(it.productId),
            variantId: parseInt(it.variantId),
            sellingUnitId: it.sellingUnitId ? parseInt(it.sellingUnitId) : null,
            unit: su?.unitName || variant?.unit || 'pcs',
            quantity: Number(it.quantity),
          };
        }),
        requiredVehicleType: selectedRate?.vehicleType || formData.preferredVehicle || null,
        vehicleBasePrice: selectedRate ? Number(selectedRate.basePrice) : null,
        pricePerKm: selectedRate ? Number(selectedRate.pricePerKm) : null,
        distanceKm,
        finalDeliveryPrice: deliveryFeeEstimate,
      };

      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        queryClient.invalidateQueries({ queryKey: ['deliveries'] });
        router.push('/admin/deliveries');
      } else {
        alert(data.error || 'Failed to create delivery');
      }
    } catch { alert('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '6px 0 20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

        {/* ── Details + Items ── */}
        <section style={sectionStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '22px' }}>

            {/* Delivery Details */}
            <div style={panelStyle}>
              <h3 style={sectionHeading}>Delivery Details</h3>
              <div>
                <label style={labelStyle}>Select Customer *</label>
                <select style={inputStyle} required onChange={handleCustomerSelect} value={formData.customerId}>
                  <option value="" disabled>Select a saved customer</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Customer Name *</label>
                  <input style={inputStyle} required value={formData.customerName} onChange={e => setFormData({ ...formData, customerName: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Contact Number *</label>
                  <input style={inputStyle} required value={formData.customerContact} onChange={e => setFormData({ ...formData, customerContact: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Delivery Date & Time *</label>
                <input type="datetime-local" required style={inputStyle} value={formData.deliveryDate} onChange={e => setFormData({ ...formData, deliveryDate: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Vehicle Required</label>
                {vehicleRates.length === 0 ? (
                  <div style={{ ...inputStyle, color: '#94a3b8', fontStyle: 'italic' }}>No vehicles configured yet</div>
                ) : (
                  <select style={inputStyle} value={formData.preferredVehicle} onChange={e => handleVehicleChange(e.target.value)}>
                    <option value="">— Select vehicle type —</option>
                    {vehicleRates.map(r => (
                      <option key={r.vehicleType} value={r.vehicleType}>
                        {r.vehicleType} — Base: ₱{Number(r.basePrice).toFixed(0)} · ₱{Number(r.pricePerKm).toFixed(0)}/km
                      </option>
                    ))}
                  </select>
                )}
              </div>
              {selectedRate && (
                <div style={{ background: '#ecfdf5', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Delivery Fee Estimate</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#374151' }}>
                    <span>Base:</span><strong style={{ color: '#15803d' }}>{formatPHP(Number(selectedRate.basePrice))}</strong>
                    <span>Per KM:</span><strong style={{ color: '#15803d' }}>₱{formatCurrency(selectedRate.pricePerKm)}/km</strong>
                    {distanceKm !== null && (<><span>Distance:</span><strong style={{ color: '#1d4ed8' }}>{distanceKm.toFixed(2)} km</strong><span>Total:</span><strong style={{ color: '#15803d', fontSize: '15px' }}>{deliveryFeeEstimate !== null ? formatPHP(deliveryFeeEstimate) : 'TBD'}</strong></>)}
                    {distanceKm === null && <span style={{ gridColumn: '1 / -1', color: '#94a3b8', fontStyle: 'italic' }}>Set route to see total fee</span>}
                  </div>
                </div>
              )}
              <div>
                <label style={labelStyle}>Delivery Instructions</label>
                <textarea style={{ ...inputStyle, height: '78px', resize: 'vertical' }} value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })} />
              </div>
            </div>

            {/* Inventory Items */}
            <div style={panelStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={sectionHeading}>Inventory Items</h3>
                <button type="button" onClick={handleAddItem} style={{ padding: '7px 14px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>No items added yet.<br />Click &quot;Add Item&quot; to assign inventory.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '420px' }}>
                  {items.map((item, index) => {
                    const variants = getVariants(item.productId);
                    const selectedVariant = variants.find(v => v.id.toString() === item.variantId);
                    const sellingUnits = getSellingUnits(item.productId, item.variantId);
                    const isOverStock = selectedVariant && Number(item.quantity) > selectedVariant.stock;
                    return (
                      <div key={index} style={{ background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b' }}>ITEM {index + 1}</span>
                          <button type="button" onClick={() => handleRemoveItem(index)} style={{ padding: '4px 8px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 700 }}>✕ Remove</button>
                        </div>
                        <div style={{ marginBottom: '8px' }}>
                          <label style={labelStyle}>Product</label>
                          <select style={inputStyle} required value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)}>
                            <option value="" disabled>Select Product</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        {item.productId && (
                          <div style={{ marginBottom: '8px' }}>
                            <label style={labelStyle}>Variant</label>
                            <select style={inputStyle} required value={item.variantId} onChange={e => handleItemChange(index, 'variantId', e.target.value)}>
                              <option value="" disabled>Select Variant</option>
                              {variants.map(v => <option key={v.id} value={v.id}>{v.name} — Stock: {v.stock}{v.price ? ` · ${formatPHP(Number(v.price))}` : ''}</option>)}
                            </select>
                            {isOverStock && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>⚠ Exceeds available stock ({selectedVariant?.stock})</div>}
                          </div>
                        )}
                        {item.variantId && sellingUnits.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <label style={labelStyle}>Selling Unit (optional)</label>
                            <select style={inputStyle} value={item.sellingUnitId} onChange={e => handleItemChange(index, 'sellingUnitId', e.target.value)}>
                              <option value="">— Use Variant Price —</option>
                              {sellingUnits.map(su => <option key={su.id} value={su.id}>{su.unitName}{su.price ? ` · ${formatPHP(Number(su.price))}` : ''} (×{Number(su.equivalentQty)} {selectedVariant?.unit || 'pcs'})</option>)}
                            </select>
                          </div>
                        )}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>
                            <label style={labelStyle}>Qty</label>
                            <input type="number" min="1" style={{ ...inputStyle, borderColor: isOverStock ? '#ef4444' : undefined }} value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value) || 0)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Unit Price</label>
                            <div style={{ ...inputStyle, background: '#f1f5f9', color: '#475569', display: 'flex', alignItems: 'center' }}>{item.variantId ? formatPHP(getItemPrice(item)) : '—'}</div>
                          </div>
                        </div>
                        {item.variantId && Number(item.quantity) > 0 && (
                          <div style={{ marginTop: '8px', textAlign: 'right', fontSize: '13px', fontWeight: 700 }}>
                            Subtotal: {formatPHP(getItemPrice(item) * Number(item.quantity))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {items.length > 0 && (
                <div style={{ marginTop: 'auto', paddingTop: '8px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#0f172a', borderTop: '1px solid #e2e8f0' }}>
                  Order Total: {formatPHP(orderTotal)}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Delivery Route ── */}
        <section style={sectionStyle}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Delivery Route</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Search for each location or click the map to pin it. You can add multiple drop-off stops.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left: Location Search Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Pickup */}
              <LocationSearchBar
                label="Pickup"
                point={pickup}
                color="#22c55e"
                onSelect={r => updateLocation(pickup.id, { address: r.address, lat: r.lat, lng: r.lng })}
                onUseCurrentLocation={() => handleCurrentLocation(pickup.id)}
              />

              {/* Drop-offs */}
              {dropoffs.map((d, idx) => (
                <LocationSearchBar
                  key={d.id}
                  label={d.label}
                  point={d}
                  color="#ef4444"
                  onSelect={r => updateLocation(d.id, { address: r.address, lat: r.lat, lng: r.lng })}
                  canRemove={dropoffs.length > 1}
                  onRemove={() => removeDropoff(d.id)}
                />
              ))}

              <button type="button" onClick={addDropoff} style={{ padding: '10px', background: '#f1f5f9', border: '1px dashed #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, color: '#475569', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                <Plus size={14} /> Add Another Drop-off
              </button>

              {/* Route status */}
              {formData.routeDistance && (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', fontSize: '13px', color: '#1d4ed8', fontWeight: 600 }}>
                  🗺 Route: {formData.routeDistance} · {formData.routeDuration}
                </div>
              )}
            </div>

            {/* Right: Single shared map */}
            <DeliveryRouteMap
              locations={locations}
              onMapPin={handleMapPin}
              onRouteCalculated={handleRouteCalculated}
            />
          </div>
        </section>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '12px 22px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>Cancel</button>
          <button type="submit" disabled={loading} style={{ padding: '12px 28px', background: loading ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '15px' }}>
            {loading ? 'Creating...' : 'Create Delivery'}
          </button>
        </div>
      </form>
    </div>
  );
}

const sectionStyle: React.CSSProperties = { background: '#f3f6fb', border: '1px solid #dfe7f1', borderRadius: '18px', padding: '18px 20px 20px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)' };
const panelStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.4)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: '16px' };
const sectionHeading: React.CSSProperties = { margin: 0, fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' };
const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white', boxSizing: 'border-box' };
