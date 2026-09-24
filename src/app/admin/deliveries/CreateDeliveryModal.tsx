'use client';

import { useState, useEffect } from 'react';
import { X, Plus, Trash2, ShoppingCart } from 'lucide-react';

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

interface OrderItem {
  productId: string;
  variantId: string;
  sellingUnitId: string;
  quantity: number | '';
}

function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: '4px', fontSize: '12px',
  fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em'
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: '8px',
  border: '1px solid #e2e8f0', fontSize: '14px', background: 'white',
  boxSizing: 'border-box', color: '#0f172a', outline: 'none',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateDeliveryModal({ isOpen, onClose, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [vehicleRates, setVehicleRates] = useState<any[]>([]);

  // Form state
  const [batchName, setBatchName] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [quota, setQuota] = useState<number | ''>('');
  const [productId, setProductId] = useState('');
  const [variantId, setVariantId] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem('token') || '';
    const headers = { Authorization: `Bearer ${token}` };

    // Fetch products with variants
    fetch('/api/products/with-variants', { headers })
      .then(r => r.json())
      .then(json => {
        setProducts(json.data || []);
      })
      .catch(() => setProducts([]));

    // Fetch customers
    fetch('/api/customers?limit=500', { headers })
      .then(r => r.json())
      .then(json => setCustomers(json.data || []))
      .catch(() => setCustomers([]));

    // Fetch vehicle rates
    fetch('/api/vehicle-rates', { headers })
      .then(r => r.json())
      .then(json => setVehicleRates(json.data || []))
      .catch(() => setVehicleRates([]));
  }, [isOpen]);

  const resetForm = () => {
    setBatchName('');
    setDeliveryDate('');
    setQuota('');
    setProductId('');
    setVariantId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !variantId) {
      alert('Please select a product and variant.'); return;
    }
    if (!quota || quota <= 0) {
      alert('Please provide a valid quota.'); return;
    }

    const finalBatchName = batchName.trim() || `Delivery Batch - ${new Date().toLocaleDateString()}`;

    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const payload = {
        customerName: finalBatchName, // Storing batch name in customerName for now
        pickupAddress: 'Warehouse',
        dropoffAddress: 'Marketplace Batch',
        deliveryDate,
        quota: Number(quota),
        orderSource: 'CREATED',
        items: [
          {
            productId: parseInt(productId),
            variantId: parseInt(variantId),
            quantity: 0, // Initial quantity is 0, wait for customers
          }
        ],
      };

      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        resetForm();
        onCreated();
        onClose();
      } else {
        alert(data.error || 'Failed to create delivery');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(4px)' }} />

      {/* Modal */}
      <div style={{
        position: 'relative', width: '100%', maxWidth: '860px',
        maxHeight: '90vh', overflowY: 'auto',
        background: '#f8fafc', borderRadius: '20px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px 16px', borderBottom: '1px solid #e2e8f0', background: 'white', borderRadius: '20px 20px 0 0', position: 'sticky', top: 0, zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Create Delivery</h2>
            <p style={{ margin: '2px 0 0', fontSize: '13px', color: '#64748b' }}>Add products and customer info to create a new delivery.</p>
          </div>
          <button onClick={onClose} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
            {/* Product & Variant Selection */}
            <div>
              <label style={labelStyle}>Product to be dispatched *</label>
              <select
                required
                style={{ ...inputStyle, padding: '12px' }}
                value={productId && variantId ? `${productId}-${variantId}` : ''}
                onChange={(e) => {
                  const [pId, vId] = e.target.value.split('-');
                  setProductId(pId);
                  setVariantId(vId);
                }}
              >
                <option value="" disabled>Select product & variant</option>
                {products.map(p => (
                  <optgroup key={p.id} label={p.name}>
                    {p.variants.map(v => (
                      <option key={`${p.id}-${v.id}`} value={`${p.id}-${v.id}`}>
                        {v.name} — Stock: {v.stock}{v.price ? ` · ${formatPHP(Number(v.price))}` : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Product Quota *</label>
                <input
                  required
                  type="number" min="1" placeholder="e.g. 50"
                  style={{ ...inputStyle, padding: '12px' }}
                  value={quota}
                  onChange={e => setQuota(e.target.value === '' ? '' : parseInt(e.target.value))}
                />
              </div>

              <div>
                <label style={labelStyle}>Delivery Date</label>
                <input
                  type="datetime-local"
                  style={{ ...inputStyle, padding: '12px' }}
                  value={deliveryDate}
                  onChange={e => setDeliveryDate(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Batch Name</label>
              <input
                style={{ ...inputStyle, padding: '12px' }}
                placeholder="e.g. Weekend Batch Delivery"
                value={batchName}
                onChange={e => setBatchName(e.target.value)}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '16px 24px', borderTop: '1px solid #e2e8f0', background: 'white', borderRadius: '0 0 20px 20px' }}>
            <button type="button" onClick={onClose} style={{ padding: '10px 20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', fontWeight: 700, color: '#475569', cursor: 'pointer', fontSize: '14px' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '10px 24px', background: loading ? '#94a3b8' : '#2563eb', color: 'white', border: 'none', borderRadius: '10px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontSize: '14px', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>
              {loading ? 'Creating...' : '✓ Create Delivery'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
