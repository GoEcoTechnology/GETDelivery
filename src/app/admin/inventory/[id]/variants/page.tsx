'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, Plus, Trash2, Edit2, X, Save, Tag, Layers, AlertTriangle
} from 'lucide-react';
import styles from '../../../admin.module.css';

const fmt = (v: any) =>
  v != null ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(v)) : '—';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #cbd5e1',
  borderRadius: 8, fontSize: 13, color: '#0f172a', background: 'white', boxSizing: 'border-box'
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#64748b',
  marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em'
};

export default function ManageVariantsPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Variant edit modal
  const [variantModal, setVariantModal] = useState<any>(null); // null | 'new' | variant obj
  const [variantForm, setVariantForm] = useState<any>({});

  // Selling unit modal
  const [unitModal, setUnitModal] = useState<{ variantId: number; unit?: any } | null>(null);
  const [unitForm, setUnitForm] = useState<any>({});

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') || '' : '';

  const fetchProduct = async () => {
    setLoading(true);
    setError('');
    try {
      const endpoint = `/api/products/${productId}/variants`;
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const fallback = await fetch(`/api/products/${productId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (!fallback.ok) {
          const payload = await fallback.json().catch(() => ({}));
          throw new Error(payload.error || `Failed to load product (${res.status})`);
        }

        const json = await fallback.json();
        setProduct(json.data);
        setLoading(false);
        return;
      }

      const json = await res.json();
      setProduct(json.data);
    } catch (err: any) {
      console.error('fetchProduct error:', err);
      setError(err.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProduct(); }, [productId]);

  /* ── Variant CRUD ── */
  const openNewVariant = () => {
    setVariantForm({ name: '', unit: '', price: '', stock: 0, lowStockThreshold: 10, status: 'ACTIVE' });
    setVariantModal('new');
  };

  const openEditVariant = (v: any) => {
    setVariantForm({ ...v });
    setVariantModal(v);
  };

  const saveVariant = async () => {
    setSaving(true);
    try {
      const isNew = variantModal === 'new';
      const url = isNew
        ? `/api/products/${productId}/variants`
        : `/api/products/${productId}/variants/${variantForm.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(variantForm),
      });
      if (res.ok) {
        setVariantModal(null);
        fetchProduct();
      } else {
        const j = await res.json();
        alert(j.error || 'Failed to save variant');
      }
    } catch {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const deleteVariant = async (variantId: number) => {
    if (!confirm('Delete this variant? This cannot be undone.')) return;
    const res = await fetch(`/api/products/${productId}/variants/${variantId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchProduct();
    else alert('Failed to delete variant');
  };

  /* ── Selling Unit CRUD ── */
  const openNewUnit = (variantId: number) => {
    setUnitForm({ unitName: '', equivalentQty: 1, price: '', status: 'ACTIVE' });
    setUnitModal({ variantId });
  };

  const openEditUnit = (variantId: number, su: any) => {
    setUnitForm({ ...su });
    setUnitModal({ variantId, unit: su });
  };

  const saveUnit = async () => {
    if (!unitModal) return;
    setSaving(true);
    try {
      const isNew = !unitModal.unit;
      const url = isNew
        ? `/api/products/${productId}/variants/${unitModal.variantId}/selling-units`
        : `/api/products/${productId}/variants/${unitModal.variantId}/selling-units/${unitForm.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(unitForm),
      });
      if (res.ok) {
        setUnitModal(null);
        fetchProduct();
      } else {
        const j = await res.json();
        alert(j.error || 'Failed to save selling unit');
      }
    } catch {
      alert('Network error');
    } finally {
      setSaving(false);
    }
  };

  const deleteUnit = async (variantId: number, unitId: number) => {
    if (!confirm('Delete this selling unit?')) return;
    const res = await fetch(`/api/products/${productId}/variants/${variantId}/selling-units/${unitId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.ok) fetchProduct();
    else alert('Failed to delete selling unit');
  };

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8' }}>Loading…</div>
  );
  if (error || !product) return (
    <div style={{ padding: 32, textAlign: 'center', color: '#ef4444' }}>
      <AlertTriangle size={24} style={{ marginBottom: 8 }} />
      <p>{error || 'Product not found'}</p>
      <button onClick={() => router.back()} style={{ marginTop: 12, padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'white', cursor: 'pointer' }}>Go Back</button>
    </div>
  );

  return (
    <div style={{ padding: '24px 32px', maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748b', fontWeight: 600, fontSize: 13 }}>
          <ArrowLeft size={14} /> Back
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Manage Variants</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b', marginTop: 2 }}>{product.name} · {product.category}</p>
        </div>
        <button
          onClick={openNewVariant}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
        >
          <Plus size={14} /> Add Variant
        </button>
      </div>

      {/* Variants */}
      {(!product.variants || product.variants.length === 0) ? (
        <div style={{ background: '#f8fafc', border: '2px dashed #cbd5e1', borderRadius: 12, padding: '40px 24px', textAlign: 'center', color: '#94a3b8' }}>
          <Tag size={28} style={{ marginBottom: 12 }} />
          <p style={{ margin: 0, fontWeight: 600 }}>No variants yet</p>
          <p style={{ margin: '6px 0 16px', fontSize: 13 }}>Add a variant to define price, stock, and unit.</p>
          <button onClick={openNewVariant} style={{ padding: '10px 20px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Add First Variant</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {product.variants.map((v: any) => (
            <div key={v.id} style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {/* Variant header */}
              <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{v.name}</span>
                {v.unit && <span style={{ padding: '2px 8px', background: '#e0e7ff', color: '#4f46e5', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{v.unit}</span>}
                <span style={{ padding: '2px 8px', background: v.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: v.status === 'ACTIVE' ? '#15803d' : '#b91c1c', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>{v.status || 'ACTIVE'}</span>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                  <button onClick={() => openEditVariant(v)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #c7d2fe', background: '#e0e7ff', color: '#4338ca', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                    <Edit2 size={12} /> Edit
                  </button>
                  {product.variants.length > 1 && (
                    <button onClick={() => deleteVariant(v.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: 8, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Variant stats */}
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 12 }}>
                {[
                  { label: 'Price', value: fmt(v.price) },
                  { label: 'Stock', value: v.stock ?? '—', color: v.stock != null && v.stock <= (v.lowStockThreshold ?? 0) ? '#dc2626' : '#16a34a' },
                  { label: 'Low Stock Threshold', value: v.lowStockThreshold ?? '—' },
                  { label: 'Unit', value: v.unit || '—' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f8fafc', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: item.color || '#0f172a' }}>{item.value}</div>
                  </div>
                ))}
              </div>

              {/* Selling units */}
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Layers size={13} style={{ color: '#8b5cf6' }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selling Units</span>
                  <button onClick={() => openNewUnit(v.id)} style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #d8b4fe', background: '#f3e8ff', color: '#7c3aed', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: 11 }}>
                    <Plus size={10} /> Add Unit
                  </button>
                </div>
                {(!v.sellingUnits || v.sellingUnits.length === 0) ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No selling units defined. Add a selling unit (e.g. "Case × 24 pcs") to allow bundle pricing.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {v.sellingUnits.map((su: any) => (
                      <div key={su.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: '#faf5ff', border: '1px solid #e9d5ff', borderRadius: 8, fontSize: 13 }}>
                        <Layers size={12} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                        <span style={{ fontWeight: 700, color: '#4c1d95' }}>{su.unitName}</span>
                        <span style={{ color: '#7c3aed' }}>× {su.equivalentQty} {v.unit}</span>
                        <span style={{ fontWeight: 700, color: '#0f172a', marginLeft: 'auto' }}>{fmt(su.price)}</span>
                        <span style={{ padding: '1px 6px', background: su.status === 'ACTIVE' ? '#dcfce7' : '#fee2e2', color: su.status === 'ACTIVE' ? '#15803d' : '#b91c1c', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>{su.status}</span>
                        <button onClick={() => openEditUnit(v.id, su)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}><Edit2 size={12} /></button>
                        <button onClick={() => deleteUnit(v.id, su.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: 4 }}><Trash2 size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Variant Modal */}
      {variantModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{variantModal === 'new' ? 'Add Variant' : 'Edit Variant'}</h2>
              <button onClick={() => setVariantModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Variant Name *</label>
                <input style={inputStyle} placeholder="e.g. 500mL, Large, Red" value={variantForm.name || ''} onChange={e => setVariantForm({ ...variantForm, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Unit</label>
                  <input style={inputStyle} placeholder="pcs, kg, L" value={variantForm.unit || ''} onChange={e => setVariantForm({ ...variantForm, unit: e.target.value })} />
                </div>
                <div>
                  <label style={labelStyle}>Price</label>
                  <input style={inputStyle} type="number" step="0.01" min="0" placeholder="0.00" value={variantForm.price || ''} onChange={e => setVariantForm({ ...variantForm, price: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Stock</label>
                  <input style={inputStyle} type="number" min="0" value={variantForm.stock ?? 0} onChange={e => setVariantForm({ ...variantForm, stock: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <label style={labelStyle}>Low Stock Alert</label>
                  <input style={inputStyle} type="number" min="0" value={variantForm.lowStockThreshold ?? 10} onChange={e => setVariantForm({ ...variantForm, lowStockThreshold: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={variantForm.status || 'ACTIVE'} onChange={e => setVariantForm({ ...variantForm, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setVariantModal(null)} style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveVariant} disabled={saving} style={{ padding: '10px 18px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save Variant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selling Unit Modal */}
      {unitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 32, width: '100%', maxWidth: 420, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{unitModal.unit ? 'Edit Selling Unit' : 'Add Selling Unit'}</h2>
              <button onClick={() => setUnitModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={labelStyle}>Unit Name *</label>
                <input style={inputStyle} placeholder="e.g. Case, Box, Dozen" value={unitForm.unitName || ''} onChange={e => setUnitForm({ ...unitForm, unitName: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Equivalent Qty</label>
                  <input style={inputStyle} type="number" min="1" step="0.01" placeholder="e.g. 24" value={unitForm.equivalentQty || ''} onChange={e => setUnitForm({ ...unitForm, equivalentQty: parseFloat(e.target.value) || 1 })} />
                </div>
                <div>
                  <label style={labelStyle}>Price</label>
                  <input style={inputStyle} type="number" step="0.01" min="0" placeholder="0.00" value={unitForm.price || ''} onChange={e => setUnitForm({ ...unitForm, price: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={unitForm.status || 'ACTIVE'} onChange={e => setUnitForm({ ...unitForm, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 24 }}>
              <button onClick={() => setUnitModal(null)} style={{ padding: '10px 18px', border: '1px solid #cbd5e1', borderRadius: 8, background: 'none', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveUnit} disabled={saving} style={{ padding: '10px 18px', background: '#7c3aed', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Save size={14} /> {saving ? 'Saving…' : 'Save Unit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
