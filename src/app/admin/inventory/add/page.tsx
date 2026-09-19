'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2, Layers, PackagePlus, ChevronDown, ChevronRight, Box, Save } from 'lucide-react';

const emptySellingUnit = () => ({
  id: Date.now() + Math.random(),
  unitName: '',
  price: '',
  description: '',
  equivalentQty: '',
  status: 'ACTIVE',
});

const emptyVariant = () => ({
  id: Date.now() + Math.random(),
  name: '',
  price: '',
  weight: '',
  quota: '',
  stock: '',
  lowStockAlert: '10',
  status: 'ACTIVE',
  sellingUnits: [],
});

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [variants, setVariants] = useState<any[]>([emptyVariant()]);
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({});

  const totalVariantCount = useMemo(() => variants.length, [variants]);
  const totalSellingUnitCount = useMemo(
    () => variants.reduce((sum, variant) => sum + (variant.sellingUnits?.length || 0), 0),
    [variants]
  );

  const updateVariant = (variantId: number, field: string, value: any) => {
    setVariants(prev => prev.map(variant => (variant.id === variantId ? { ...variant, [field]: value } : variant)));
  };

  const addVariant = () => {
    const next = emptyVariant();
    setVariants(prev => [...prev, next]);
    setExpandedVariants(prev => ({ ...prev, [next.id]: true }));
  };

  const removeVariant = (variantId: number) => {
    setVariants(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(variant => variant.id !== variantId);
    });
  };

  const updateSellingUnit = (variantId: number, unitId: number, field: string, value: any) => {
    setVariants(prev => prev.map(variant => {
      if (variant.id !== variantId) return variant;
      return {
        ...variant,
        sellingUnits: (variant.sellingUnits || []).map((unit: any) =>
          unit.id === unitId ? { ...unit, [field]: value } : unit
        ),
      };
    }));
  };

  const addSellingUnit = (variantId: number) => {
    const nextUnit = emptySellingUnit();
    setVariants(prev => prev.map(variant => {
      if (variant.id !== variantId) return variant;
      return { ...variant, sellingUnits: [...(variant.sellingUnits || []), nextUnit] };
    }));
  };

  const removeSellingUnit = (variantId: number, unitId: number) => {
    setVariants(prev => prev.map(variant => {
      if (variant.id !== variantId) return variant;
      return {
        ...variant,
        sellingUnits: (variant.sellingUnits || []).filter((unit: any) => unit.id !== unitId),
      };
    }));
  };

  const toggleVariant = (variantId: number) => {
    setExpandedVariants(prev => ({ ...prev, [variantId]: !prev[variantId] }));
  };

  const handleSubmit = async () => {
    if (!productName.trim()) {
      alert('Product Name is required.');
      return;
    }

    const invalidVariant = variants.find(variant => (
      !variant.name.trim() || variant.price === '' ||
      variant.weight === '' || variant.quota === '' || variant.stock === '' || variant.lowStockAlert === ''
    ));
    if (invalidVariant) {
      alert('Each variant requires a name, price, weight, quota, current stock, and low stock alert.');
      return;
    }

    const sanitizedVariants = variants.map(variant => ({
      name: variant.name.trim(),
      quantity: 1,
      price: Number(variant.price),
      weight: variant.weight,
      quota: Number(variant.quota),
      stock: Number(variant.stock),
      lowStockThreshold: Number(variant.lowStockAlert),
      status: variant.status || 'ACTIVE',
      sellingUnits: (variant.sellingUnits || []).map((unit: any) => ({
        unitName: unit.unitName.trim(),
        description: unit.description.trim(),
        price: Number(unit.price),
        equivalentQty: Number(unit.equivalentQty),
        status: unit.status || 'ACTIVE',
      })),
    }));

    const invalidUnit = sanitizedVariants.some((variant: any) => variant.sellingUnits.some((unit: any) => (
      !unit.unitName || !unit.description || !Number.isFinite(unit.equivalentQty) || unit.equivalentQty <= 0 ||
      !Number.isFinite(unit.price)
    )));
    if (invalidUnit) {
      alert('Each selling unit requires a name, quantity per unit, description, and selling price.');
      return;
    }

    try {
      setLoading(true);
      const payload = {
        name: productName.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        variants: sanitizedVariants,
      };

      const token = localStorage.getItem('token') || '';
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create product');
      }

      alert('Product created successfully.');
      router.push('/admin/inventory');
    } catch (error: any) {
      alert(error.message || 'Unable to create product.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 48px' }}>
      <div style={{ marginBottom: 24 }}>
        <button
          type="button"
          onClick={() => router.push('/admin/inventory')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: 'none', background: 'transparent', color: '#64748b',
            cursor: 'pointer', padding: 0, fontWeight: 600, marginBottom: 12,
          }}
        >
          <ArrowLeft size={16} /> Back to Inventory
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <PackagePlus size={28} color="#4f46e5" />
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, color: '#0f172a' }}>Create Product</h1>
        </div>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Create one product, then add as many variants and selling units as needed.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 22, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Product Information</h2>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#4f46e5', background: '#eef2ff', padding: '6px 10px', borderRadius: 999 }}>
              1 product
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                Product Name *</label>
              <input
                value={productName}
                onChange={e => setProductName(e.target.value)}
                placeholder="e.g. Coca-Cola"
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                Category *</label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Soft Drinks"
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', fontSize: 15, boxSizing: 'border-box' }}
              />
            </div>



            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add product details, notes, or specifications."
                rows={4}
                style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '12px 14px', fontSize: 15, resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
          </div>
        </section>

        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 22, boxShadow: '0 6px 18px rgba(15,23,42,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Variants</h2>
              <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 14 }}>
                Add variant sizes, flavors, weights, or packaging options for this product.
              </p>
            </div>
            <button
              type="button"
              onClick={addVariant}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#4f46e5', color: 'white', border: 'none',
                borderRadius: 10, padding: '10px 16px', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} /> Add Variant
            </button>
          </div>

          <div style={{ display: 'grid', gap: 16 }}>
            {variants.map((variant, index) => {
              const isExpanded = expandedVariants[variant.id] ?? true;
              const sellingUnits = variant.sellingUnits || [];

              return (
                <div key={variant.id} style={{ border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none' }}>
                    <button
                      type="button"
                      onClick={() => toggleVariant(variant.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, border: '1px solid #dbeafe', background: '#eff6ff', color: '#2563eb', cursor: 'pointer' }}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>

                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(90px, 1fr))', gap: 12 }}>
                      <div style={{ gridColumn: 'span 2' }}>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                          Variant Name
                        </label>
                        <input
                          required
                          value={variant.name}
                          onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>Price *</label>
                        <input required type="number" min={0} step="0.01" value={variant.price} onChange={e => updateVariant(variant.id, 'price', e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }} />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                          Quota *
                        </label>
                        <input
                          required
                          type="number"
                          min={0}
                          value={variant.quota}
                          onChange={e => updateVariant(variant.id, 'quota', e.target.value)}
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                          Weight (kg) *
                        </label>
                        <input
                          required
                          type="number"
                          min={0}
                          step="0.001"
                          value={variant.weight}
                          onChange={e => updateVariant(variant.id, 'weight', e.target.value)}
                          style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>Stock *</label>
                        <input required type="number" min={0} value={variant.stock} onChange={e => updateVariant(variant.id, 'stock', e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }} />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>Low Stock *</label>
                        <input required type="number" min={0} value={variant.lowStockAlert} onChange={e => updateVariant(variant.id, 'lowStockAlert', e.target.value)} style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => addSellingUnit(variant.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#f3e8ff', color: '#7c3aed', border: '1px solid #d8b4fe', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                      >
                        <Plus size={14} /> Add Selling Unit
                      </button>
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 8, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer' }}
                          title="Delete variant"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ padding: '16px 18px 18px' }}>
                      {sellingUnits.length === 0 ? (
                        <div style={{ border: '1px dashed #cbd5e1', borderRadius: 12, padding: '18px', textAlign: 'center', color: '#64748b', background: '#fff' }}>
                          No selling units yet. Add a unit such as Bottle, Case, or Bundle.
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          {sellingUnits.map((unit: any, unitIndex: number) => (
                            <div key={unit.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 14 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Box size={15} color="#7c3aed" />
                                  <span style={{ fontWeight: 700, color: '#334155' }}>Selling Unit {unitIndex + 1}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeSellingUnit(variant.id, unit.id)}
                                  style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', borderRadius: 8, padding: '6px 10px', fontWeight: 700, cursor: 'pointer' }}
                                >
                                  <Trash2 size={14} /> Delete
                                </button>
                              </div>

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
                                <div>
                                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                                    Selling Unit Name
                                  </label>
                                  <input
                                    required
                                    value={unit.unitName}
                                    onChange={e => updateSellingUnit(variant.id, unit.id, 'unitName', e.target.value)}
                                    placeholder="Bottle"
                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                                    Selling Price *
                                  </label>
                                  <input
                                    required
                                    type="number"
                                    min={0}
                                    step="0.01"
                                    value={unit.price}
                                    onChange={e => updateSellingUnit(variant.id, unit.id, 'price', e.target.value)}
                                    placeholder="20.00"
                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                                    Qty per Unit *
                                  </label>
                                  <input
                                    required
                                    type="number"
                                    min={1}
                                    value={unit.equivalentQty}
                                    onChange={e => updateSellingUnit(variant.id, unit.id, 'equivalentQty', e.target.value)}
                                    placeholder="24"
                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                                    Description *
                                  </label>
                                  <input
                                    required
                                    value={unit.description}
                                    onChange={e => updateSellingUnit(variant.id, unit.id, 'description', e.target.value)}
                                    placeholder="1 Case = 24 bottles"
                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box' }}
                                  />
                                </div>

                                <div>
                                  <label style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', color: '#64748b', textTransform: 'uppercase' }}>
                                    Status *
                                  </label>
                                  <select
                                    required
                                    value={unit.status}
                                    onChange={e => updateSellingUnit(variant.id, unit.id, 'status', e.target.value)}
                                    style={{ width: '100%', border: '1px solid #cbd5e1', borderRadius: 10, padding: '10px 12px', boxSizing: 'border-box', background: '#fff' }}
                                  >
                                    <option value="ACTIVE">Active</option>
                                    <option value="INACTIVE">Inactive</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 18, padding: 18 }}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: '#475569' }}>
            <span style={{ padding: '6px 10px', background: '#eff6ff', borderRadius: 999, color: '#1d4ed8', fontWeight: 700 }}>
              {totalVariantCount} variants
            </span>
            <span style={{ padding: '6px 10px', background: '#f5f3ff', borderRadius: 999, color: '#7c3aed', fontWeight: 700 }}>
              {totalSellingUnitCount} selling units
            </span>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="button"
              onClick={() => router.push('/admin/inventory')}
              style={{ padding: '12px 18px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 18px', border: 'none', background: '#4f46e5',
                color: '#fff', borderRadius: 10, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              }}
            >
              <Save size={16} /> {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

