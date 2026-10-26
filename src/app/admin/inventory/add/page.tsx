'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Plus,
  Trash2,
  PackagePlus,
  ChevronDown,
  ChevronRight,
  Box,
  Save,
  Layers,
} from 'lucide-react';
import PackageSizeSelector from '@/components/PackageSizeSelector';
import { PACKAGE_SIZE_OPTIONS, detectPackageTierCode } from '@/lib/packageSizes';

const emptySellingUnit = (parentPackageSize = 'SMALL', parentWeight = '') => {
  const tier = PACKAGE_SIZE_OPTIONS.find(t => t.code === parentPackageSize) || PACKAGE_SIZE_OPTIONS[0];
  return {
    id: Date.now() + Math.random(),
    unitName: '',
    price: '',
    weightKg: parentWeight || tier.defaultWeight || '1.0',
    description: '',
    equivalentQty: '1',
    status: 'ACTIVE',
    packageSize: tier.code,
    lengthCm: tier.defaultLength,
    widthCm: tier.defaultWidth,
    heightCm: tier.defaultHeight,
  };
};

const emptyVariant = (defaultName = 'Regular') => {
  const defaultTier = PACKAGE_SIZE_OPTIONS[0]; // SMALL
  return {
    id: Date.now() + Math.random(),
    name: defaultName,
    price: '',
    weightKg: defaultTier.defaultWeight || '1.0',
    packageSize: defaultTier.code,
    lengthCm: defaultTier.defaultLength,
    widthCm: defaultTier.defaultWidth,
    heightCm: defaultTier.defaultHeight,
    quota: '',
    stock: '',
    lowStockAlert: '10',
    status: 'ACTIVE',
    sellingUnits: [],
  };
};

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [isShippable, setIsShippable] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [variants, setVariants] = useState<any[]>([emptyVariant('Regular')]);
  const [expandedVariants, setExpandedVariants] = useState<Record<number, boolean>>({});

  const totalVariantCount = useMemo(() => variants.length, [variants]);
  const totalSellingUnitCount = useMemo(
    () => variants.reduce((sum, variant) => sum + (variant.sellingUnits?.length || 0), 0),
    [variants]
  );

  const updateVariant = (variantId: number, field: string, value: any) => {
    setVariants(prev => prev.map(v => (v.id === variantId ? { ...v, [field]: value } : v)));
  };

  const addVariant = () => {
    const nextNumber = variants.length + 1;
    const next = emptyVariant(`Variant ${nextNumber}`);
    setVariants(prev => [...prev, next]);
    setExpandedVariants(prev => ({ ...prev, [next.id]: true }));
  };

  const removeVariant = (variantId: number) => {
    setVariants(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(v => v.id !== variantId);
    });
  };

  const toggleVariant = (variantId: number) => {
    setExpandedVariants(prev => ({ ...prev, [variantId]: !prev[variantId] }));
  };

  const addSellingUnit = (variantId: number) => {
    const parentVariant = variants.find(v => v.id === variantId);
    const nextUnit = emptySellingUnit(parentVariant?.packageSize || 'SMALL', parentVariant?.weightKg || '');
    setVariants(prev =>
      prev.map(v => {
        if (v.id !== variantId) return v;
        return { ...v, sellingUnits: [...(v.sellingUnits || []), nextUnit] };
      })
    );
  };

  const updateSellingUnit = (variantId: number, unitId: number, field: string, value: any) => {
    setVariants(prev =>
      prev.map(v => {
        if (v.id !== variantId) return v;
        return {
          ...v,
          sellingUnits: (v.sellingUnits || []).map((u: any) =>
            u.id === unitId ? { ...u, [field]: value } : u
          ),
        };
      })
    );
  };

  const removeSellingUnit = (variantId: number, unitId: number) => {
    setVariants(prev =>
      prev.map(v => {
        if (v.id !== variantId) return v;
        return {
          ...v,
          sellingUnits: (v.sellingUnits || []).filter((u: any) => u.id !== unitId),
        };
      })
    );
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};

    if (!productName.trim()) {
      newErrors.productName = 'Product Name is required.';
    }

    if (variants.length === 0) {
      newErrors.variants = 'At least one variant is required.';
    }

    // Validate variants
    for (let i = 0; i < variants.length; i++) {
      const v = variants[i];
      if (!v.name?.trim()) {
        newErrors[`variant_${v.id}_name`] = 'Variant name is required.';
      }
      const price = Number(v.price);
      if (v.price === '' || !Number.isFinite(price) || price < 0) {
        newErrors[`variant_${v.id}_price`] = 'Price must be 0 or greater.';
      }
      const weight = Number(v.weightKg);
      if (v.weightKg === '' || !Number.isFinite(weight) || weight <= 0) {
        newErrors[`variant_${v.id}_weightKg`] = 'Weight (kg) must be greater than 0.';
      }
      const stock = Number(v.stock);
      if (v.stock === '' || !Number.isFinite(stock) || stock < 0) {
        newErrors[`variant_${v.id}_stock`] = 'Stock must be 0 or greater.';
      }
      if (isShippable && !v.packageSize) {
        newErrors[`variant_${v.id}_packageSize`] = 'Select a size.';
      }

      // Validate selling units if any
      const sellingUnits = v.sellingUnits || [];
      for (let j = 0; j < sellingUnits.length; j++) {
        const u = sellingUnits[j];
        if (!u.unitName?.trim()) {
          newErrors[`unit_${u.id}_name`] = 'Unit name is required.';
        }
        const uPrice = Number(u.price);
        if (u.price === '' || !Number.isFinite(uPrice) || uPrice < 0) {
          newErrors[`unit_${u.id}_price`] = 'Price must be 0 or greater.';
        }
        const uWeight = Number(u.weightKg);
        if (u.weightKg === '' || !Number.isFinite(uWeight) || uWeight <= 0) {
          newErrors[`unit_${u.id}_weightKg`] = 'Weight (kg) must be greater than 0.';
        }
        const uQty = Number(u.equivalentQty);
        if (u.equivalentQty === '' || !Number.isFinite(uQty) || uQty <= 0) {
          newErrors[`unit_${u.id}_qty`] = 'Qty must be at least 1.';
        }
        if (isShippable && !u.packageSize) {
          newErrors[`unit_${u.id}_packageSize`] = 'Select a size.';
        }
      }
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      alert('Please correct the highlighted fields before saving.');
      return;
    }

    const sanitizedVariants = variants.map(variant => {
      const tierObj = PACKAGE_SIZE_OPTIONS.find(t => t.code === variant.packageSize) || PACKAGE_SIZE_OPTIONS[0];
      const vWeight = variant.weightKg || tierObj.defaultWeight;
      const vLength = variant.lengthCm || tierObj.defaultLength;
      const vWidth = variant.widthCm || tierObj.defaultWidth;
      const vHeight = variant.heightCm || tierObj.defaultHeight;

      return {
        name: variant.name.trim(),
        quantity: 1,
        price: Number(variant.price),
        weight: String(vWeight),
        weightKg: isShippable ? String(vWeight) : null,
        lengthCm: isShippable ? String(vLength) : null,
        widthCm: isShippable ? String(vWidth) : null,
        heightCm: isShippable ? String(vHeight) : null,
        quota: Number(variant.quota) || 0,
        stock: Number(variant.stock),
        lowStockThreshold: Number(variant.lowStockAlert) || 10,
        status: variant.status || 'ACTIVE',
        sellingUnits: (variant.sellingUnits || []).map((unit: any) => {
          const uTier = PACKAGE_SIZE_OPTIONS.find(t => t.code === unit.packageSize) || tierObj;
          const uWeight = unit.weightKg || uTier.defaultWeight;
          const uLength = unit.lengthCm || uTier.defaultLength;
          const uWidth = unit.widthCm || uTier.defaultWidth;
          const uHeight = unit.heightCm || uTier.defaultHeight;

          return {
            unitName: unit.unitName.trim(),
            description: (unit.description || `${unit.unitName.trim()} (${unit.equivalentQty} pcs)`).trim(),
            price: Number(unit.price),
            equivalentQty: Number(unit.equivalentQty),
            weightKg: isShippable ? String(uWeight) : null,
            lengthCm: isShippable ? String(uLength) : null,
            widthCm: isShippable ? String(uWidth) : null,
            heightCm: isShippable ? String(uHeight) : null,
            status: unit.status || 'ACTIVE',
          };
        }),
      };
    });

    const primaryVariant = sanitizedVariants[0];

    try {
      setLoading(true);
      const payload = {
        name: productName.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        isShippable,
        weightKg: isShippable ? primaryVariant?.weightKg : null,
        lengthCm: isShippable ? primaryVariant?.lengthCm : null,
        widthCm: isShippable ? primaryVariant?.widthCm : null,
        heightCm: isShippable ? primaryVariant?.heightCm : null,
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
    <div style={{ width: '100%', padding: '20px 28px 60px', boxSizing: 'border-box' }}>
      {/* Top Header Bar */}
      <div style={{ marginBottom: 18 }}>
        <button
          type="button"
          onClick={() => router.push('/admin/inventory')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            border: 'none',
            background: 'transparent',
            color: '#64748b',
            cursor: 'pointer',
            padding: 0,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 8,
          }}
        >
          <ArrowLeft size={14} /> Back to Inventory
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4f46e5',
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#0f172a' }}>Create Product</h1>
              <p style={{ margin: '1px 0 0', color: '#64748b', fontSize: 13 }}>
                Configure product details, variants, inventory stock, and packaging sizes.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => router.push('/admin/inventory')}
              style={{
                padding: '8px 16px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 20px',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
              }}
            >
              <Save size={15} /> {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {/* ========================================================================= */}
        {/* SECTION 1: PRODUCT INFORMATION (FULL-WIDTH, NO PACKAGE SIZES) */}
        {/* ========================================================================= */}
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '18px 22px',
            boxShadow: '0 2px 6px rgba(15,23,42,0.02)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: '1px solid #f1f5f9',
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              Product Information
            </h2>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: '#4f46e5',
                background: '#eef2ff',
                padding: '4px 10px',
                borderRadius: 20,
              }}
            >
              Basic Info
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Product Name */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product Name *
                </label>
                {errors.productName && (
                  <span style={{ color: '#dc2626', fontSize: 11, fontWeight: 600 }}>{errors.productName}</span>
                )}
              </div>
              <input
                value={productName}
                onChange={e => {
                  setProductName(e.target.value);
                  setErrors(p => ({ ...p, productName: '' }));
                }}
                placeholder="e.g. Portland Cement / Organic Arabica Coffee"
                style={{
                  width: '100%',
                  border: `1.5px solid ${errors.productName ? '#ef4444' : '#cbd5e1'}`,
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Category */}
            <div>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Category
              </label>
              <input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="e.g. Construction Materials"
                style={{
                  width: '100%',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 14,
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            {/* Description */}
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add product details, handling notes, or specifications..."
                rows={2}
                style={{
                  width: '100%',
                  border: '1.5px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '9px 12px',
                  fontSize: 13,
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 2: PRODUCT VARIANTS (FULL WIDTH, CLEAN COMPACT DATA) */}
        {/* ========================================================================= */}
        <section
          style={{
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '18px 22px',
            boxShadow: '0 2px 6px rgba(15,23,42,0.02)',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              paddingBottom: 10,
              borderBottom: '1px solid #f1f5f9',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Layers size={18} color="#4f46e5" />
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
                Product Variants
              </h2>
            </div>

            <button
              type="button"
              onClick={addVariant}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#4f46e5',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 14px',
                fontWeight: 700,
                fontSize: 13,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79,70,229,0.2)',
              }}
            >
              <Plus size={15} /> Add Variant
            </button>
          </div>

          {/* Variants List */}
          <div style={{ display: 'grid', gap: 16 }}>
            {variants.map((variant, index) => {
              const isExpanded = expandedVariants[variant.id] ?? true;
              const sellingUnits = variant.sellingUnits || [];
              const selectedTier = PACKAGE_SIZE_OPTIONS.find(t => t.code === variant.packageSize);

              return (
                <div
                  key={variant.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    overflow: 'hidden',
                    background: '#fff',
                    boxShadow: '0 1px 4px rgba(15,23,42,0.02)',
                  }}
                >
                  {/* Variant Top Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 10,
                      padding: '10px 14px',
                      background: '#f8fafc',
                      borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 300px' }}>
                      <button
                        type="button"
                        onClick={() => toggleVariant(variant.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#475569',
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                        title={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </button>

                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 800,
                          color: '#4f46e5',
                          background: '#eef2ff',
                          padding: '3px 8px',
                          borderRadius: 6,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        #{index + 1}
                      </span>

                      <div style={{ flex: 1, minWidth: 150 }}>
                        <input
                          value={variant.name}
                          onChange={e => updateVariant(variant.id, 'name', e.target.value)}
                          placeholder="Variant Name (e.g. Regular, 500g, Blue)"
                          style={{
                            width: '100%',
                            border: `1.5px solid ${errors[`variant_${variant.id}_name`] ? '#ef4444' : '#cbd5e1'}`,
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#0f172a',
                            background: '#fff',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {selectedTier && isShippable && (
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 6,
                            background: selectedTier.bg,
                            color: selectedTier.color,
                            border: `1px solid ${selectedTier.border}`,
                          }}
                        >
                          📦 {selectedTier.name} ({selectedTier.shortRangeLabel || selectedTier.rangeLabel})
                        </span>
                      )}

                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVariant(variant.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: 6,
                            border: '1px solid #fecaca',
                            background: '#fff1f2',
                            color: '#dc2626',
                            cursor: 'pointer',
                          }}
                          title="Delete variant"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Variant Body */}
                  {isExpanded && (
                    <div style={{ padding: '14px 16px 18px', display: 'grid', gap: 14 }}>
                      {/* Pricing & Stock Fields Grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                          gap: 10,
                        }}
                      >
                        <div>
                          <label style={{ display: 'block', marginBottom: 3, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Price (₱) *
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={variant.price}
                            onChange={e => {
                              updateVariant(variant.id, 'price', e.target.value);
                              setErrors(p => ({ ...p, [`variant_${variant.id}_price`]: '' }));
                            }}
                            style={{
                              width: '100%',
                              border: `1.5px solid ${errors[`variant_${variant.id}_price`] ? '#ef4444' : '#cbd5e1'}`,
                              borderRadius: 6,
                              padding: '7px 10px',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                            <label style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                              Weight (kg) *
                            </label>
                            {errors[`variant_${variant.id}_weightKg`] && (
                              <span style={{ color: '#dc2626', fontSize: 10, fontWeight: 700 }}>
                                {errors[`variant_${variant.id}_weightKg`]}
                              </span>
                            )}
                          </div>
                          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              placeholder="1.0"
                              value={variant.weightKg ?? ''}
                              onChange={e => {
                                updateVariant(variant.id, 'weightKg', e.target.value);
                                setErrors(p => ({ ...p, [`variant_${variant.id}_weightKg`]: '' }));
                              }}
                              style={{
                                width: '100%',
                                border: `1.5px solid ${errors[`variant_${variant.id}_weightKg`] ? '#ef4444' : '#cbd5e1'}`,
                                borderRadius: 6,
                                padding: '7px 32px 7px 10px',
                                fontSize: 13,
                                fontWeight: 600,
                                boxSizing: 'border-box',
                              }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                right: 10,
                                fontSize: 11,
                                fontWeight: 700,
                                color: '#94a3b8',
                                pointerEvents: 'none',
                              }}
                            >
                              kg
                            </span>
                          </div>
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 3, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Stock *
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={variant.stock}
                            onChange={e => {
                              updateVariant(variant.id, 'stock', e.target.value);
                              setErrors(p => ({ ...p, [`variant_${variant.id}_stock`]: '' }));
                            }}
                            style={{
                              width: '100%',
                              border: `1.5px solid ${errors[`variant_${variant.id}_stock`] ? '#ef4444' : '#cbd5e1'}`,
                              borderRadius: 6,
                              padding: '7px 10px',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 3, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Quota
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="Max per order"
                            value={variant.quota}
                            onChange={e => updateVariant(variant.id, 'quota', e.target.value)}
                            style={{
                              width: '100%',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '7px 10px',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', marginBottom: 3, fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                            Low Stock Alert
                          </label>
                          <input
                            type="number"
                            min="0"
                            placeholder="10"
                            value={variant.lowStockAlert}
                            onChange={e => updateVariant(variant.id, 'lowStockAlert', e.target.value)}
                            style={{
                              width: '100%',
                              border: '1.5px solid #cbd5e1',
                              borderRadius: 6,
                              padding: '7px 10px',
                              fontSize: 13,
                              boxSizing: 'border-box',
                            }}
                          />
                        </div>
                      </div>

                      {/* Variant Package Size (Compact 6-tier selector) */}
                      {isShippable && (
                        <div>
                          <PackageSizeSelector
                            compact
                            title="Variant Package Size *"
                            selectedCode={variant.packageSize}
                            error={errors[`variant_${variant.id}_packageSize`]}
                            onSelect={tier => {
                              updateVariant(variant.id, 'packageSize', tier.code);
                              updateVariant(variant.id, 'weightKg', tier.defaultWeight);
                              updateVariant(variant.id, 'lengthCm', tier.defaultLength);
                              updateVariant(variant.id, 'widthCm', tier.defaultWidth);
                              updateVariant(variant.id, 'heightCm', tier.defaultHeight);
                              setErrors(p => ({
                                ...p,
                                [`variant_${variant.id}_packageSize`]: '',
                                [`variant_${variant.id}_weightKg`]: '',
                              }));
                            }}
                          />
                        </div>
                      )}

                      {/* Selling Units Section */}
                      <div
                        style={{
                          border: '1px solid #e9d5ff',
                          borderRadius: 10,
                          background: '#faf5ff',
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 10,
                            flexWrap: 'wrap',
                            gap: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Box size={16} color="#7c3aed" />
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#4c1d95' }}>
                              Selling Units
                            </span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: '#7c3aed',
                                background: '#ede9fe',
                                padding: '1px 6px',
                                borderRadius: 999,
                              }}
                            >
                              {sellingUnits.length}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => addSellingUnit(variant.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '5px 10px',
                              background: '#7c3aed',
                              color: '#fff',
                              border: 'none',
                              borderRadius: 6,
                              fontWeight: 700,
                              fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            <Plus size={13} /> Add Unit
                          </button>
                        </div>

                        {sellingUnits.length === 0 ? (
                          <div
                            style={{
                              border: '1px dashed #cbd5e1',
                              borderRadius: 8,
                              padding: '10px',
                              textAlign: 'center',
                              color: '#64748b',
                              fontSize: 12,
                              background: '#fff',
                            }}
                          >
                            No selling units. Click <strong>+ Add Unit</strong> if sold in bulk packaging (e.g. Case of 24).
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 10 }}>
                            {sellingUnits.map((unit: any, unitIdx: number) => (
                              <div
                                key={unit.id}
                                style={{
                                  background: '#fff',
                                  border: '1px solid #d8b4fe',
                                  borderRadius: 8,
                                  padding: 12,
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    marginBottom: 8,
                                    borderBottom: '1px solid #f3e8ff',
                                    paddingBottom: 6,
                                  }}
                                >
                                  <span style={{ fontSize: 12, fontWeight: 800, color: '#581c87' }}>
                                    Unit #{unitIdx + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => removeSellingUnit(variant.id, unit.id)}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 3,
                                      border: '1px solid #fecaca',
                                      background: '#fff1f2',
                                      color: '#b91c1c',
                                      borderRadius: 4,
                                      padding: '2px 6px',
                                      fontSize: 11,
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    <Trash2 size={11} /> Remove
                                  </button>
                                </div>

                                <div
                                  style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                    gap: 8,
                                    marginBottom: 8,
                                  }}
                                >
                                  <div>
                                    <label style={{ display: 'block', marginBottom: 2, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                      Unit Name *
                                    </label>
                                    <input
                                      value={unit.unitName}
                                      onChange={e => {
                                        updateSellingUnit(variant.id, unit.id, 'unitName', e.target.value);
                                        setErrors(p => ({ ...p, [`unit_${unit.id}_name`]: '' }));
                                      }}
                                      placeholder="Case, Box, Bundle"
                                      style={{
                                        width: '100%',
                                        border: `1.5px solid ${errors[`unit_${unit.id}_name`] ? '#ef4444' : '#cbd5e1'}`,
                                        borderRadius: 6,
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                                      <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                        Weight (kg) *
                                      </label>
                                      {errors[`unit_${unit.id}_weightKg`] && (
                                        <span style={{ color: '#dc2626', fontSize: 9, fontWeight: 700 }}>
                                          {errors[`unit_${unit.id}_weightKg`]}
                                        </span>
                                      )}
                                    </div>
                                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                      <input
                                        type="number"
                                        min="0.01"
                                        step="0.01"
                                        value={unit.weightKg ?? ''}
                                        onChange={e => {
                                          updateSellingUnit(variant.id, unit.id, 'weightKg', e.target.value);
                                          setErrors(p => ({ ...p, [`unit_${unit.id}_weightKg`]: '' }));
                                        }}
                                        placeholder="1.0"
                                        style={{
                                          width: '100%',
                                          border: `1.5px solid ${errors[`unit_${unit.id}_weightKg`] ? '#ef4444' : '#cbd5e1'}`,
                                          borderRadius: 6,
                                          padding: '6px 28px 6px 8px',
                                          fontSize: 12,
                                          fontWeight: 600,
                                          boxSizing: 'border-box',
                                        }}
                                      />
                                      <span
                                        style={{
                                          position: 'absolute',
                                          right: 8,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          color: '#94a3b8',
                                          pointerEvents: 'none',
                                        }}
                                      >
                                        kg
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: 2, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                      Price (₱) *
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={unit.price}
                                      onChange={e => {
                                        updateSellingUnit(variant.id, unit.id, 'price', e.target.value);
                                        setErrors(p => ({ ...p, [`unit_${unit.id}_price`]: '' }));
                                      }}
                                      placeholder="0.00"
                                      style={{
                                        width: '100%',
                                        border: `1.5px solid ${errors[`unit_${unit.id}_price`] ? '#ef4444' : '#cbd5e1'}`,
                                        borderRadius: 6,
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: 2, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                      Qty per Unit *
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={unit.equivalentQty}
                                      onChange={e => {
                                        updateSellingUnit(variant.id, unit.id, 'equivalentQty', e.target.value);
                                        setErrors(p => ({ ...p, [`unit_${unit.id}_qty`]: '' }));
                                      }}
                                      placeholder="24"
                                      style={{
                                        width: '100%',
                                        border: `1.5px solid ${errors[`unit_${unit.id}_qty`] ? '#ef4444' : '#cbd5e1'}`,
                                        borderRadius: 6,
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: 2, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                      Description
                                    </label>
                                    <input
                                      value={unit.description}
                                      onChange={e => updateSellingUnit(variant.id, unit.id, 'description', e.target.value)}
                                      placeholder="1 Box contains 24 pcs"
                                      style={{
                                        width: '100%',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: 6,
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        boxSizing: 'border-box',
                                      }}
                                    />
                                  </div>

                                  <div>
                                    <label style={{ display: 'block', marginBottom: 2, fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                                      Status
                                    </label>
                                    <select
                                      value={unit.status}
                                      onChange={e => updateSellingUnit(variant.id, unit.id, 'status', e.target.value)}
                                      style={{
                                        width: '100%',
                                        border: '1.5px solid #cbd5e1',
                                        borderRadius: 6,
                                        padding: '6px 8px',
                                        fontSize: 12,
                                        background: '#fff',
                                        boxSizing: 'border-box',
                                      }}
                                    >
                                      <option value="ACTIVE">Active</option>
                                      <option value="INACTIVE">Inactive</option>
                                    </select>
                                  </div>
                                </div>

                                {/* Selling Unit Package Size Selector */}
                                {isShippable && (
                                  <div>
                                    <PackageSizeSelector
                                      compact
                                      title="Unit Package Size *"
                                      selectedCode={unit.packageSize || variant.packageSize}
                                      error={errors[`unit_${unit.id}_packageSize`]}
                                      onSelect={tier => {
                                        updateSellingUnit(variant.id, unit.id, 'packageSize', tier.code);
                                        updateSellingUnit(variant.id, unit.id, 'weightKg', tier.defaultWeight);
                                        updateSellingUnit(variant.id, unit.id, 'lengthCm', tier.defaultLength);
                                        updateSellingUnit(variant.id, unit.id, 'widthCm', tier.defaultWidth);
                                        updateSellingUnit(variant.id, unit.id, 'heightCm', tier.defaultHeight);
                                        setErrors(p => ({
                                          ...p,
                                          [`unit_${unit.id}_packageSize`]: '',
                                          [`unit_${unit.id}_weightKg`]: '',
                                        }));
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* BOTTOM ACTION BAR */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '12px 20px',
            boxShadow: '0 2px 6px rgba(15,23,42,0.02)',
          }}
        >
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                padding: '4px 10px',
                background: '#eff6ff',
                borderRadius: 16,
                color: '#1d4ed8',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {totalVariantCount} {totalVariantCount === 1 ? 'Variant' : 'Variants'}
            </span>
            <span
              style={{
                padding: '4px 10px',
                background: '#f5f3ff',
                borderRadius: 16,
                color: '#7c3aed',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {totalSellingUnitCount} Selling {totalSellingUnitCount === 1 ? 'Unit' : 'Units'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={() => router.push('/admin/inventory')}
              style={{
                padding: '9px 18px',
                border: '1px solid #cbd5e1',
                background: '#fff',
                color: '#475569',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 22px',
                border: 'none',
                background: '#4f46e5',
                color: '#fff',
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                boxShadow: '0 2px 6px rgba(79,70,229,0.25)',
              }}
            >
              <Save size={15} /> {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
