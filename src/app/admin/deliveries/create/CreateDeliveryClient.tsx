'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import styles from '../../admin.module.css';

// Dynamically import components that need browser APIs
const LocationAutocomplete = dynamic(() => import('@/components/LocationAutocomplete'), { ssr: false });
const RouteMapPreview = dynamic(() => import('@/components/RouteMapPreview'), { ssr: false });

interface Customer {
  id: number;
  name: string;
  mobileNumber: string;
  address: string;
  barangay: string | null;
  municipality: string | null;
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
  stock: number;
  unit: string | null;
  price?: number;
}

interface Props {
  customers: Customer[];
  products: Product[];
}

export default function CreateDeliveryClient({ customers, products }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const draftKey = 'create-delivery-form-draft';

  const [formData, setFormData] = useState(() => {
    if (typeof window === 'undefined') {
      return {
        customerId: '',
        customerName: '',
        customerContact: '',
        pickupAddress: '',
        pickupLat: undefined as number | undefined,
        pickupLng: undefined as number | undefined,
        dropoffAddress: '',
        dropoffLat: undefined as number | undefined,
        dropoffLng: undefined as number | undefined,
        routeDistance: '',
        routeDuration: '',
        routePolyline: '',
        deliveryDate: '',
        instructions: '',
        preferredVehicle: '',
      };
    }

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          customerId: parsed.formData?.customerId || '',
          customerName: parsed.formData?.customerName || '',
          customerContact: parsed.formData?.customerContact || '',
          pickupAddress: parsed.formData?.pickupAddress || '',
          pickupLat: parsed.formData?.pickupLat,
          pickupLng: parsed.formData?.pickupLng,
          dropoffAddress: parsed.formData?.dropoffAddress || '',
          dropoffLat: parsed.formData?.dropoffLat,
          dropoffLng: parsed.formData?.dropoffLng,
          routeDistance: parsed.formData?.routeDistance || '',
          routeDuration: parsed.formData?.routeDuration || '',
          routePolyline: parsed.formData?.routePolyline || '',
          deliveryDate: parsed.formData?.deliveryDate || '',
          instructions: parsed.formData?.instructions || '',
          preferredVehicle: parsed.formData?.preferredVehicle || '',
        };
      }
    } catch {}

    return {
      customerId: '',
      customerName: '',
      customerContact: '',
      pickupAddress: '',
      pickupLat: undefined as number | undefined,
      pickupLng: undefined as number | undefined,
      dropoffAddress: '',
      dropoffLat: undefined as number | undefined,
      dropoffLng: undefined as number | undefined,
      routeDistance: '',
      routeDuration: '',
      routePolyline: '',
      deliveryDate: '',
      instructions: '',
      preferredVehicle: '',
    };
  });

  const [items, setItems] = useState<{ productId: string; quantity: number; unit: string }[]>(() => {
    if (typeof window === 'undefined') return [];

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items)) return parsed.items;
      }
    } catch {}

    return [];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(draftKey, JSON.stringify({ formData, items }));
    }
  }, [formData, items, draftKey]);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const selected = customers.find(c => c.id.toString() === customerId);
    if (selected) {
      const address = [selected.address, selected.barangay, selected.municipality].filter(Boolean).join(', ');
      setFormData(prev => ({
        ...prev,
        customerId: selected.id.toString(),
        customerName: selected.name,
        customerContact: selected.mobileNumber,
        dropoffAddress: address,
        dropoffLat: undefined,
        dropoffLng: undefined,
      }));
    }
  };

  const handlePickupSelect = (result: { address: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      pickupAddress: result.address,
      pickupLat: result.lat,
      pickupLng: result.lng,
      routeDistance: '',
      routeDuration: '',
      routePolyline: '',
    }));
  };

  const handleDropoffSelect = (result: { address: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      dropoffAddress: result.address,
      dropoffLat: result.lat,
      dropoffLng: result.lng,
      routeDistance: '',
      routeDuration: '',
      routePolyline: '',
    }));
  };

  const handleRouteCalculated = (data: { distance: string; duration: string; polyline: string }) => {
    setFormData(prev => ({
      ...prev,
      routeDistance: data.distance,
      routeDuration: data.duration,
      routePolyline: data.polyline,
    }));
  };

  const handleAddItem = () => setItems([...items, { productId: '', quantity: 1, unit: 'pcs' }]);
  const handleRemoveItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const handleItemChange = (i: number, field: string, value: any) => {
    const updated = [...items];
    if (field === 'productId') {
      const p = products.find(p => p.id.toString() === value);
      updated[i] = { ...updated[i], productId: value, unit: p?.unit || 'pcs' };
    } else {
      updated[i] = { ...updated[i], [field]: value };
    }
    setItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { alert('You must add at least one item to deliver'); return; }
    if (!formData.pickupLat || !formData.pickupLng) {
      alert('Please select a valid Pickup Location from the search results.');
      return;
    }
    if (!formData.dropoffLat || !formData.dropoffLng) {
      alert('Please select a valid Destination from the search results.');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ...formData, items }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem(draftKey);
        queryClient.invalidateQueries({ queryKey: ['deliveries'] });
        router.push('/admin/deliveries');
      } else {
        alert(data.error || 'Failed to create delivery');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '6px 0 20px' }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        <section style={{ background: '#f3f6fb', border: '1px solid #dfe7f1', borderRadius: '18px', padding: '18px 20px 20px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '22px' }}>
            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Delivery Details</h3>

              <div>
                <label style={labelStyle}>Select Customer *</label>
                <select style={inputStyle} required onChange={handleCustomerSelect} value={formData.customerId}>
                  <option value="" disabled>Select a saved customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
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
                <label style={labelStyle}>Preferred Vehicle</label>
                <select style={inputStyle} value={formData.preferredVehicle} onChange={e => setFormData({ ...formData, preferredVehicle: e.target.value })}>
                  <option value="">Any Vehicle / Not Specified</option>
                  <option value="Motorcycle">Motorcycle</option>
                  <option value="Sedan / Hatchback">Sedan / Hatchback</option>
                  <option value="SUV / MPV">SUV / MPV</option>
                  <option value="L300 / Van">L300 / Van</option>
                  <option value="Small Truck">Small Truck</option>
                  <option value="Large Truck">Large Truck</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Delivery Instructions</label>
                <textarea style={{ ...inputStyle, height: '78px', resize: 'vertical' }} value={formData.instructions} onChange={e => setFormData({ ...formData, instructions: e.target.value })} />
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.4)', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 18px 14px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Inventory Items</h3>
                <button type="button" onClick={handleAddItem} style={{ padding: '7px 14px', background: '#e2e8f0', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, color: '#334155', fontSize: '12px' }}>
                  + Add Item
                </button>
              </div>

              {items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  No items added yet.<br />Click “+ Add Item” to assign inventory.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {items.map((item, index) => (
                    <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                      <div style={{ flex: 2 }}>
                        <label style={labelStyle}>Product</label>
                        <select style={inputStyle} required value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)}>
                          <option value="" disabled>Select Product</option>
                          {products.map(p => (
                            <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock}){p.price ? ` — ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(p.price)}` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={labelStyle}>Qty</label>
                        <input type="number" min="1" style={inputStyle} value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value) || 0)} />
                      </div>
                      <button type="button" onClick={() => handleRemoveItem(index)} style={{ padding: '10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '7px', cursor: 'pointer', height: '41px', marginTop: 'auto' }}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: 'auto', paddingTop: '8px', textAlign: 'right', fontWeight: 800, fontSize: '18px', color: '#0f172a' }}>
                Order Total: {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(items.reduce((sum, it) => {
                  const p = products.find(pp => pp.id.toString() === it.productId);
                  const price = p ? Number(p.price ?? 0) : 0;
                  return sum + (price * (it.quantity || 0));
                }, 0))}
              </div>
            </div>
          </div>
        </section>

        <section style={{ background: '#f3f6fb', border: '1px solid #dfe7f1', borderRadius: '18px', padding: '18px 20px 20px', boxShadow: '0 4px 20px rgba(15, 23, 42, 0.02)' }}>
          <div style={{ marginBottom: '18px' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 800, color: '#64748b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Delivery Route</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Search and select exact locations. The route will be automatically calculated and saved with the delivery.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <LocationAutocomplete
              label="Pickup Location"
              placeholder="Search business, address, landmark..."
              value={formData.pickupAddress}
              onSelect={handlePickupSelect}
              required
            />
            <LocationAutocomplete
              label="Destination"
              placeholder="Search business, address, landmark..."
              value={formData.dropoffAddress}
              onSelect={handleDropoffSelect}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px', marginBottom: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: formData.pickupLat ? '#22c55e' : '#cbd5e1', display: 'inline-block' }} />
              <span style={{ color: formData.pickupLat ? '#16a34a' : '#64748b' }}>{formData.pickupLat ? 'Pickup located' : 'Pickup not set'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: formData.dropoffLat ? '#22c55e' : '#cbd5e1', display: 'inline-block' }} />
              <span style={{ color: formData.dropoffLat ? '#16a34a' : '#64748b' }}>{formData.dropoffLat ? 'Destination located' : 'Destination not set'}</span>
            </div>
            {formData.routeDistance && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', display: 'inline-block' }} />
                <span style={{ color: '#1d4ed8' }}>Route calculated: {formData.routeDistance} · {formData.routeDuration}</span>
              </div>
            )}
          </div>

          <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #dfe7f1' }}>
            <RouteMapPreview
              pickupLat={formData.pickupLat}
              pickupLng={formData.pickupLng}
              dropoffLat={formData.dropoffLat}
              dropoffLng={formData.dropoffLng}
              onRouteCalculated={handleRouteCalculated}
            />
          </div>
        </section>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '12px 22px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, color: '#475569' }}>
            Cancel
          </button>
          <button type="submit" disabled={loading} style={{ padding: '12px 28px', background: loading ? '#94a3b8' : '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '15px' }}>
            {loading ? 'Creating...' : 'Create Delivery'}
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' };
const inputStyle: React.CSSProperties = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white', boxSizing: 'border-box' };
