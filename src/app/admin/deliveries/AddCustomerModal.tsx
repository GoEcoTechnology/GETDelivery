'use client';
import { useState, useEffect, useRef } from 'react';
import { X, User, MapPin, Package, CheckCircle2 } from 'lucide-react';

// Inject Leaflet CSS once
if (typeof window !== 'undefined' && !document.getElementById('leaflet-css')) {
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);
}

type SellingUnit = {
  id: number;
  unitName: string;
  price: string | number | null;
  equivalentQty: string | number | null;
};

export type ProductContext = {
  deliveryId: number;
  itemId: number;
  productId: number;
  productName: string;
  variantId: number;
  variantName: string;
  unit: string | null;
  sellingUnits: SellingUnit[];
  targetQuantity: number;
  currentAccumulated: number;
  pickupAddress: string;
};

type AddCustomerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  context: ProductContext | null;
  onSuccess: (deliveryId: number, addedCount: number) => void;
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: '1.5px solid #e2e8f0',
  borderRadius: '10px',
  fontSize: '14px',
  color: '#0f172a',
  background: '#fff',
  outline: 'none',
  transition: 'border-color 0.2s',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '6px',
  letterSpacing: '0.03em',
  textTransform: 'uppercase' as const,
};

export function AddCustomerModal({ isOpen, onClose, context, onSuccess }: AddCustomerModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [form, setForm] = useState({
    customerName: '',
    contactNumber: '',
    address: '',
    landmark: '',
    sellingUnitId: '',
    quantity: '',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;
    if (leafletMapRef.current) return;

    const timeout = setTimeout(() => {
      import('leaflet').then((L) => {
        if (!mapRef.current || leafletMapRef.current) return;
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        const map = L.map(mapRef.current!).setView([14.5995, 120.9842], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(map);

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          setCoords({ lat, lng });
          setErrors(prev => ({ ...prev, coords: '' }));
          if (markerRef.current) {
            markerRef.current.setLatLng([lat, lng]);
          } else {
            markerRef.current = L.marker([lat, lng]).addTo(map);
          }
        });

        leafletMapRef.current = map;
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        markerRef.current = null;
      }
      setForm({ customerName: '', contactNumber: '', address: '', landmark: '', sellingUnitId: '', quantity: '' });
      setCoords(null);
      setSearchQuery('');
      setSearchResults([]);
      setErrors({});
      setSubmitted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = 'unset';
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleSearch = async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    setSearchResults([]);
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=7&addressdetails=1&countrycodes=ph`;
      const res = await fetch(url, {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'GETDelivery/1.0 (getdelivery@gmail.com)'
        }
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Debounced auto-search on query change
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => handleSearch(searchQuery), 500);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);


  const handleSelectResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    setCoords({ lat, lng });
    setSearchResults([]);
    setSearchQuery(result.display_name);
    if (!form.address) setForm(prev => ({ ...prev, address: result.display_name }));
    setErrors(prev => ({ ...prev, coords: '' }));

    import('leaflet').then((L) => {
      if (!leafletMapRef.current) return;
      leafletMapRef.current.setView([lat, lng], 16);
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        markerRef.current = L.marker([lat, lng]).addTo(leafletMapRef.current);
      }
    });
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.customerName.trim()) errs.customerName = 'Customer name is required';
    if (!form.contactNumber.trim()) errs.contactNumber = 'Contact number is required';
    else if (!/^[0-9+\-\s()]{7,20}$/.test(form.contactNumber.trim())) errs.contactNumber = 'Enter a valid contact number';
    if (!form.address.trim()) errs.address = 'Address is required';
    if (!form.landmark.trim()) errs.landmark = 'Landmark is required';
    if (!coords) errs.coords = 'Please pin the customer location on the map';
    const qty = parseInt(form.quantity, 10);
    if (!form.quantity || isNaN(qty) || qty <= 0) errs.quantity = 'Quantity must be greater than 0';
    else {
      const remaining = (context?.targetQuantity || 0) - (context?.currentAccumulated || 0);
      if (qty > remaining) errs.quantity = `Max remaining capacity: ${remaining}`;
    }
    return errs;
  };

  const handleSubmit = async () => {
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token') || '';
      const qty = parseInt(form.quantity, 10);
      const su = context?.sellingUnits.find((s: SellingUnit) => s.id.toString() === form.sellingUnitId);
      const unit = su?.unitName || context?.unit || 'pcs';

      const res = await fetch(`/api/deliveries/${context!.deliveryId}/add-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          itemId: context!.itemId,
          customerName: form.customerName.trim(),
          contactNumber: form.contactNumber.trim(),
          address: form.address.trim(),
          landmark: form.landmark.trim(),
          lat: coords!.lat,
          lng: coords!.lng,
          productId: context!.productId,
          variantId: context!.variantId,
          sellingUnitId: form.sellingUnitId ? parseInt(form.sellingUnitId, 10) : null,
          unit,
          quantity: qty,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add customer');
      setSubmitted(true);
      onSuccess(context!.deliveryId, qty);
      setTimeout(() => { onClose(); setSubmitted(false); }, 1200);
    } catch (err: any) {
      setErrors({ submit: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !context) return null;

  const remaining = (context.targetQuantity || 0) - (context.currentAccumulated || 0);
  const progressPct = Math.min(100, ((context.currentAccumulated || 0) / (context.targetQuantity || 1)) * 100);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.55)', backdropFilter: 'blur(6px)' }} onClick={onClose} />
      <div style={{ position: 'relative', width: '100%', maxWidth: '960px', background: 'white', borderRadius: '24px', boxShadow: '0 32px 80px rgba(0,0,0,0.25)', display: 'flex', flexDirection: 'column', maxHeight: '95vh', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '20px 28px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: 'white' }}>Add Customer Order</div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
              {context.productName}{context.variantName ? ` - ${context.variantName}` : ''}{context.unit ? ` (${context.unit})` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '3px', letterSpacing: '0.05em' }}>QUOTA PROGRESS</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{context.currentAccumulated} / {context.targetQuantity} units</div>
              <div style={{ height: '4px', background: 'rgba(255,255,255,0.25)', borderRadius: '2px', width: '120px', marginTop: '5px' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'white', borderRadius: '2px' }} />
              </div>
            </div>
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          
          {/* Left — Form */}
          <div style={{ width: '380px', flexShrink: 0, padding: '24px', overflowY: 'auto', borderRight: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Customer Info */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ width: '28px', height: '28px', background: '#eff6ff', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={14} color="#3b82f6" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em' }}>CUSTOMER INFORMATION</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Customer Name <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: errors.customerName ? '#ef4444' : '#e2e8f0' }} placeholder="Juan dela Cruz" value={form.customerName} onChange={e => { setForm(p => ({ ...p, customerName: e.target.value })); setErrors(p => ({ ...p, customerName: '' })); }} />
                  {errors.customerName && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '3px' }}>{errors.customerName}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Contact Number <span style={{ color: '#ef4444' }}>*</span></label>
                  <input type="tel" style={{ ...inputStyle, borderColor: errors.contactNumber ? '#ef4444' : '#e2e8f0' }} placeholder="09123456789" value={form.contactNumber} onChange={e => { setForm(p => ({ ...p, contactNumber: e.target.value })); setErrors(p => ({ ...p, contactNumber: '' })); }} />
                  {errors.contactNumber && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '3px' }}>{errors.contactNumber}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Complete Delivery Address <span style={{ color: '#ef4444' }}>*</span></label>
                  <textarea style={{ ...inputStyle, minHeight: '68px', resize: 'vertical' as const, borderColor: errors.address ? '#ef4444' : '#e2e8f0' }} placeholder="House No., Street, Barangay, City..." value={form.address} onChange={e => { setForm(p => ({ ...p, address: e.target.value })); setErrors(p => ({ ...p, address: '' })); }} />
                  {errors.address && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '3px' }}>{errors.address}</div>}
                </div>
                <div>
                  <label style={labelStyle}>Landmark <span style={{ color: '#ef4444' }}>*</span></label>
                  <input style={{ ...inputStyle, borderColor: errors.landmark ? '#ef4444' : '#e2e8f0' }} placeholder="Near Jollibee, Blue gate..." value={form.landmark} onChange={e => { setForm(p => ({ ...p, landmark: e.target.value })); setErrors(p => ({ ...p, landmark: '' })); }} />
                  {errors.landmark && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '3px' }}>{errors.landmark}</div>}
                </div>
              </div>
            </section>

            {/* Order Info */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ width: '28px', height: '28px', background: '#f0fdf4', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={14} color="#16a34a" />
                </div>
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em' }}>ORDER INFORMATION</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Product</label>
                  <div style={{ ...inputStyle, background: '#f8fafc', color: '#475569' }}>
                    {context.productName}{context.variantName ? ` - ${context.variantName}` : ''}
                  </div>
                </div>
                {context.sellingUnits.length > 0 && (
                  <div>
                    <label style={labelStyle}>Selling Unit</label>
                    <select style={inputStyle} value={form.sellingUnitId} onChange={e => setForm(p => ({ ...p, sellingUnitId: e.target.value }))}>
                      <option value="">Default ({context.unit || 'pcs'})</option>
                      {context.sellingUnits.map((su: SellingUnit) => (
                        <option key={su.id} value={su.id}>
                          {su.unitName}{su.equivalentQty ? ` (= ${su.equivalentQty} ${context.unit || 'pcs'})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label style={labelStyle}>
                    Quantity Ordered <span style={{ color: '#ef4444' }}>*</span>
                    <span style={{ fontWeight: 500, fontSize: '11px', marginLeft: '6px', color: remaining <= 0 ? '#ef4444' : '#64748b' }}>
                      {remaining <= 0 ? 'Quota full!' : `Max: ${remaining}`}
                    </span>
                  </label>
                  <input type="number" min={1} max={remaining} style={{ ...inputStyle, borderColor: errors.quantity ? '#ef4444' : '#e2e8f0' }} placeholder="e.g. 5" value={form.quantity} onChange={e => { setForm(p => ({ ...p, quantity: e.target.value })); setErrors(p => ({ ...p, quantity: '' })); }} />
                  {errors.quantity && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '3px' }}>{errors.quantity}</div>}
                </div>
              </div>
            </section>
          </div>

          {/* Right — Map */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative' }}>
            {/* Search bar — floats above the map */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #f1f5f9', background: '#fafafa' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <MapPin size={14} color="#3b82f6" />
                <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a', letterSpacing: '0.06em' }}>PINPOINT LOCATION</span>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Click map or search to drop pin</span>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...inputStyle, paddingRight: searching ? '36px' : '14px' }}
                  placeholder="Type to search an address..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {/* Spinning indicator */}
                {searching && (
                  <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', border: '2px solid #e2e8f0', borderTop: '2px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                )}

                {/* Results dropdown — absolutely positioned, overlays the map */}
                {searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    zIndex: 9999,
                    boxShadow: '0 12px 32px rgba(0,0,0,0.15)',
                    marginTop: '4px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}>
                    {searchResults.map((r: any, i: number) => (
                      <div
                        key={i}
                        onClick={() => { handleSelectResult(r); setSearchResults([]); }}
                        style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: '#0f172a', borderBottom: i < searchResults.length - 1 ? '1px solid #f1f5f9' : 'none', lineHeight: 1.4 }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#f0f9ff')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'white')}
                      >
                        {r.display_name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errors.coords && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '5px' }}>{errors.coords}</div>}
              {coords && (
                <div style={{ marginTop: '6px', fontSize: '12px', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}>
                  <CheckCircle2 size={13} /> Location pinned
                </div>
              )}
            </div>
            <div ref={mapRef} style={{ flex: 1, minHeight: '300px' }} />

            {/* Spin keyframe */}
            <style>{`@keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }`}</style>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 28px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', color: errors.submit ? '#ef4444' : '#64748b', fontWeight: errors.submit ? 600 : 400 }}>
            {errors.submit || 'Fill all fields and pin the location before saving.'}
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={onClose} style={{ padding: '10px 20px', background: 'white', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontWeight: 600, fontSize: '14px', color: '#475569', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSubmit} disabled={submitting || submitted} style={{ padding: '10px 28px', background: submitted ? '#16a34a' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, fontSize: '14px', cursor: submitting || submitted ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', opacity: submitting ? 0.7 : 1 }}>
              {submitted ? <><CheckCircle2 size={16} /> Added!</> : submitting ? 'Saving...' : '+ Add Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
