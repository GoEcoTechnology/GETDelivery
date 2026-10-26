'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Truck, Plus, DollarSign, Activity, Settings, Zap, CheckCircle2, Search, Trash2, X, Box } from 'lucide-react';

type RateRow = { 
  vehicleType: string; 
  basePrice: string | number; 
  pricePerKm: string | number; 
  capacityKg?: string | number;
  cargoLengthCm?: string | number;
  cargoWidthCm?: string | number;
  cargoHeightCm?: string | number;
  isActive: boolean;
};

function defaultSpecsFor(type: string) {
  const lower = type.toLowerCase();
  if (lower.includes('10 wheeler') || lower.includes('heavy truck')) {
    return { capacityKg: 5000, cargoLengthCm: 600, cargoWidthCm: 240, cargoHeightCm: 240, pricePerKm: 120 };
  }
  if (lower.includes('truck')) {
    return { capacityKg: 3000, cargoLengthCm: 420, cargoWidthCm: 200, cargoHeightCm: 200, pricePerKm: 80 };
  }
  if (lower.includes('travis') || lower.includes('van') || lower.includes('l300')) {
    return { capacityKg: 1000, cargoLengthCm: 230, cargoWidthCm: 150, cargoHeightCm: 130, pricePerKm: 45 };
  }
  if (lower.includes('pick')) {
    return { capacityKg: 1000, cargoLengthCm: 200, cargoWidthCm: 150, cargoHeightCm: 100, pricePerKm: 25 };
  }
  if (lower.includes('sedan') || lower.includes('car')) {
    return { capacityKg: 300, cargoLengthCm: 100, cargoWidthCm: 90, cargoHeightCm: 80, pricePerKm: 20 };
  }
  if (lower.includes('motor')) {
    return { capacityKg: 20, cargoLengthCm: 40, cargoWidthCm: 40, cargoHeightCm: 40, pricePerKm: 10 };
  }
  return { capacityKg: 200, cargoLengthCm: 120, cargoWidthCm: 90, cargoHeightCm: 80, pricePerKm: 20 };
}

export default function DeliveryPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('PHP');
  const [pricePerKm, setPricePerKm] = useState('20');
  const [urgentDeliveryFee, setUrgentDeliveryFee] = useState('50');
  const [rates, setRates] = useState<RateRow[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [newVehicle, setNewVehicle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeView, setActiveView] = useState<'vehicles' | 'sizes' | 'both'>('vehicles');

  // Add Class Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalVehicleType, setModalVehicleType] = useState('');
  const [modalCapacityKg, setModalCapacityKg] = useState('200');
  const [modalCargoLengthCm, setModalCargoLengthCm] = useState('120');
  const [modalCargoWidthCm, setModalCargoWidthCm] = useState('90');
  const [modalCargoHeightCm, setModalCargoHeightCm] = useState('80');
  const [modalPricePerKm, setModalPricePerKm] = useState('25');

  const [categories, setCategories] = useState<any[]>([]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery.trim()) return categories;
    const q = searchQuery.toLowerCase();
    return categories.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.code && c.code.toLowerCase().includes(q)) ||
      (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, searchQuery]);

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem('token') || '';
        const [pricingRes, categoriesRes] = await Promise.all([
          fetch('/api/platform-admin/delivery-pricing', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('/api/package-categories', { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (pricingRes.ok) {
          const json = await pricingRes.json();
          setCurrencyCode(json.data?.settings?.currencyCode || 'PHP');
          setPricePerKm(String(json.data?.settings?.pricePerKm || '20'));
          setUrgentDeliveryFee(String(json.data?.settings?.urgentDeliveryFee || '50'));
          setRates(json.data?.rates || []);
          setVehicleTypes((json.data?.vehicleTypes || []).map((v: { vehicleType: string }) => v.vehicleType));
        }

        if (categoriesRes.ok) {
          const json = await categoriesRes.json();
          setCategories(json.data || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mergedRates = useMemo(() => {
    const map = new Map<string, RateRow>(rates.map(r => {
      const def = defaultSpecsFor(r.vehicleType);
      return [r.vehicleType, {
        ...r,
        capacityKg: r.capacityKg !== undefined && r.capacityKg !== null && Number(r.capacityKg) > 0 ? r.capacityKg : def.capacityKg,
        cargoLengthCm: r.cargoLengthCm !== undefined && r.cargoLengthCm !== null && Number(r.cargoLengthCm) > 0 ? r.cargoLengthCm : def.cargoLengthCm,
        cargoWidthCm: r.cargoWidthCm !== undefined && r.cargoWidthCm !== null && Number(r.cargoWidthCm) > 0 ? r.cargoWidthCm : def.cargoWidthCm,
        cargoHeightCm: r.cargoHeightCm !== undefined && r.cargoHeightCm !== null && Number(r.cargoHeightCm) > 0 ? r.cargoHeightCm : def.cargoHeightCm,
      }];
    }));

    vehicleTypes.forEach(type => {
      if (!map.has(type)) {
        const def = defaultSpecsFor(type);
        map.set(type, { 
          vehicleType: type, 
          basePrice: '0', 
          pricePerKm: def.pricePerKm, 
          capacityKg: def.capacityKg,
          cargoLengthCm: def.cargoLengthCm,
          cargoWidthCm: def.cargoWidthCm,
          cargoHeightCm: def.cargoHeightCm,
          isActive: true 
        });
      }
    });

    const allRates = Array.from(map.values()).sort((a, b) => a.vehicleType.localeCompare(b.vehicleType));
    
    if (searchQuery.trim()) {
      return allRates.filter(r => r.vehicleType.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return allRates;
  }, [rates, vehicleTypes, searchQuery]);

  const updateRate = (vehicleType: string, patch: Partial<RateRow>) => {
    setRates(prev => {
      const existing = prev.find(r => r.vehicleType === vehicleType);
      if (!existing) {
        const def = defaultSpecsFor(vehicleType);
        return [...prev, { 
          vehicleType, 
          basePrice: '0', 
          pricePerKm: def.pricePerKm, 
          capacityKg: def.capacityKg,
          cargoLengthCm: def.cargoLengthCm,
          cargoWidthCm: def.cargoWidthCm,
          cargoHeightCm: def.cargoHeightCm,
          isActive: true, 
          ...patch 
        }];
      }
      return prev.map(r => r.vehicleType === vehicleType ? { ...r, ...patch } : r);
    });
  };

  const updateCategory = (code: string, patch: Record<string, any>) => {
    setCategories(prev => prev.map(c => c.code === code ? { ...c, ...patch } : c));
  };

  const handleAddVehicle = () => {
    const trimmed = newVehicle.trim();
    if (!trimmed) {
      setIsAddModalOpen(true);
      return;
    }
    if (!rates.some(r => r.vehicleType.toLowerCase() === trimmed.toLowerCase()) && !vehicleTypes.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      const def = defaultSpecsFor(trimmed);
      setRates(prev => [
        { 
          vehicleType: trimmed, 
          basePrice: '0', 
          pricePerKm: def.pricePerKm, 
          capacityKg: def.capacityKg,
          cargoLengthCm: def.cargoLengthCm,
          cargoWidthCm: def.cargoWidthCm,
          cargoHeightCm: def.cargoHeightCm,
          isActive: true 
        },
        ...prev
      ]);
      setNewVehicle('');
    }
  };

  const handleModalAddVehicle = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = modalVehicleType.trim();
    if (!trimmed) return;
    if (!rates.some(r => r.vehicleType.toLowerCase() === trimmed.toLowerCase()) && !vehicleTypes.some(v => v.toLowerCase() === trimmed.toLowerCase())) {
      setRates(prev => [
        {
          vehicleType: trimmed,
          basePrice: '0',
          pricePerKm: Number(modalPricePerKm) || 20,
          capacityKg: Math.max(1, parseInt(modalCapacityKg, 10) || 100),
          cargoLengthCm: Math.max(10, Number(modalCargoLengthCm) || 100),
          cargoWidthCm: Math.max(10, Number(modalCargoWidthCm) || 80),
          cargoHeightCm: Math.max(10, Number(modalCargoHeightCm) || 80),
          isActive: true,
        },
        ...prev,
      ]);
    }
    setIsAddModalOpen(false);
    setModalVehicleType('');
  };

  const handleRemoveVehicle = async (vehicleType: string) => {
    if (!confirm(`Are you sure you want to remove the class "${vehicleType}"?`)) return;
    try {
      const res = await fetch(`/api/platform-admin/delivery-pricing?vehicleType=${encodeURIComponent(vehicleType)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        setRates(prev => prev.filter(r => r.vehicleType !== vehicleType));
        setVehicleTypes(prev => prev.filter(v => v !== vehicleType));
      } else {
        alert('Failed to remove class');
      }
    } catch (e) {
      alert('Failed to remove class');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const token = localStorage.getItem('token') || '';
      const [pricingRes, categoriesRes] = await Promise.all([
        fetch('/api/platform-admin/delivery-pricing', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            currencyCode,
            pricePerKm: Number(pricePerKm),
            urgentDeliveryFee: Number(urgentDeliveryFee),
            rates: mergedRates.map(r => ({ 
              vehicleType: r.vehicleType, 
              basePrice: 0, 
              pricePerKm: Number(r.pricePerKm || 0),
              capacityKg: Math.max(0, parseInt(String(r.capacityKg || 0), 10) || 0),
              cargoLengthCm: Math.max(0, Number(r.cargoLengthCm || 0)),
              cargoWidthCm: Math.max(0, Number(r.cargoWidthCm || 0)),
              cargoHeightCm: Math.max(0, Number(r.cargoHeightCm || 0)),
              isActive: r.isActive 
            })),
          })
        }),
        fetch('/api/package-categories', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ categories })
        })
      ]);

      if (!pricingRes.ok || !categoriesRes.ok) throw new Error('Failed to save settings');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: '#64748b' }}>
        <Activity className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', padding: '24px', fontFamily: "'Inter', sans-serif", boxSizing: 'border-box' }}>
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '24px' }}>
        <button 
          type="button"
          onClick={handleSave} 
          disabled={saving} 
          style={{ 
            display: 'inline-flex', alignItems: 'center', gap: '8px', 
            background: saveSuccess ? '#10b981' : 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', 
            color: 'white', border: 'none', borderRadius: '12px', 
            padding: '14px 28px', fontSize: '15px', fontWeight: 600, 
            cursor: saving ? 'not-allowed' : 'pointer',
            boxShadow: saveSuccess ? '0 4px 14px rgba(16, 185, 129, 0.4)' : '0 4px 14px rgba(79, 70, 229, 0.3)',
            transform: saving ? 'scale(0.98)' : 'scale(1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {saving ? <Activity className="animate-spin" size={18} /> : saveSuccess ? <CheckCircle2 size={18} /> : <Save size={18} />}
          {saving ? 'Applying...' : saveSuccess ? 'Saved successfully!' : 'Save Configuration'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Global Settings */}
        <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(15,23,42,0.05)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#3b82f6' }}><Settings size={18} /></div>
            Global Settings
          </h2>
          
          <div style={{ display: 'grid', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#64748b', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Urgent Delivery Fee</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontWeight: 600 }}>{currencyCode === 'PHP' ? '₱' : currencyCode}</span>
                <input 
                  type="number" min="0" step="0.01" 
                  value={urgentDeliveryFee} 
                  onChange={e => setUrgentDeliveryFee(e.target.value)} 
                  style={{ width: '100%', padding: '14px 16px 14px 36px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 600, color: '#0f172a', transition: 'all 0.2s', outline: 'none', background: '#f8fafc' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Info Card */}
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '20px', padding: '32px', color: 'white', display: 'flex', flexDirection: 'column', justifyContent: 'center', position: 'relative', overflow: 'hidden', boxShadow: '0 20px 40px -15px rgba(15,23,42,0.4)' }}>
          <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.1, transform: 'rotate(15deg)' }}>
            <Zap size={140} />
          </div>
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}><DollarSign size={24} color="#38bdf8" /> Fleet Pricing Structure</h3>
          <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: 0, fontSize: '15px', position: 'relative', zIndex: 1 }}>
            Delivery fee is calculated strictly from delivery distance and weight/size pricing. No vehicle base fees are charged to customers. Vehicles are selected based on weight capacity (kg) and 3D cargo space (L × W × H cm).
          </p>
        </div>
      </div>

      {/* View Toggle Bar (Vehicles vs Product Sizes) */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        background: '#fff',
        padding: '10px 16px',
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 16px -4px rgba(15, 23, 42, 0.05)'
      }}>
        {/* Toggle Pill Buttons */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '5px', borderRadius: '14px', gap: '6px' }}>
          {/* Vehicles Toggle */}
          <button
            type="button"
            id="toggle-vehicles-btn"
            onClick={() => setActiveView('vehicles')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '14px',
              fontWeight: activeView === 'vehicles' ? 700 : 600,
              cursor: 'pointer',
              background: activeView === 'vehicles' ? '#fff' : 'transparent',
              color: activeView === 'vehicles' ? '#9333ea' : '#64748b',
              boxShadow: activeView === 'vehicles' ? '0 4px 12px rgba(147, 51, 234, 0.15)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Truck size={18} color={activeView === 'vehicles' ? '#9333ea' : '#64748b'} />
            <span>Vehicle Fleet & Rates</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '20px',
              background: activeView === 'vehicles' ? '#f3e8ff' : '#e2e8f0',
              color: activeView === 'vehicles' ? '#7e22ce' : '#64748b'
            }}>
              {mergedRates.length}
            </span>
          </button>

          {/* Product Sizes Toggle */}
          <button
            type="button"
            id="toggle-product-sizes-btn"
            onClick={() => setActiveView('sizes')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 22px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '14px',
              fontWeight: activeView === 'sizes' ? 700 : 600,
              cursor: 'pointer',
              background: activeView === 'sizes' ? '#fff' : 'transparent',
              color: activeView === 'sizes' ? '#2563eb' : '#64748b',
              boxShadow: activeView === 'sizes' ? '0 4px 12px rgba(37, 99, 235, 0.15)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <Box size={18} color={activeView === 'sizes' ? '#2563eb' : '#64748b'} />
            <span>Product Sizes</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 700,
              padding: '3px 9px',
              borderRadius: '20px',
              background: activeView === 'sizes' ? '#eff6ff' : '#e2e8f0',
              color: activeView === 'sizes' ? '#1d4ed8' : '#64748b'
            }}>
              {categories.length}
            </span>
          </button>

          {/* Show Both Toggle */}
          <button
            type="button"
            id="toggle-both-btn"
            onClick={() => setActiveView('both')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              border: 'none',
              fontSize: '14px',
              fontWeight: activeView === 'both' ? 700 : 600,
              cursor: 'pointer',
              background: activeView === 'both' ? '#fff' : 'transparent',
              color: activeView === 'both' ? '#0f172a' : '#64748b',
              boxShadow: activeView === 'both' ? '0 4px 12px rgba(15, 23, 42, 0.12)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <span>Show Both</span>
          </button>
        </div>

        {/* Current Active Mode Indicator */}
        <div style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Active View:</span>
          <span style={{
            fontWeight: 700,
            color: activeView === 'vehicles' ? '#9333ea' : activeView === 'sizes' ? '#2563eb' : '#0f172a',
            background: activeView === 'vehicles' ? '#f3e8ff' : activeView === 'sizes' ? '#eff6ff' : '#f1f5f9',
            padding: '4px 12px',
            borderRadius: '8px',
            fontSize: '12px'
          }}>
            {activeView === 'vehicles' ? '🚚 Vehicle Fleet & Capacity' : activeView === 'sizes' ? '📦 Product & Package Sizes' : '📋 All Specifications'}
          </span>
        </div>
      </div>

      {/* Vehicle Pricing Section */}
      {(activeView === 'vehicles' || activeView === 'both') && (
      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(15,23,42,0.05)', overflow: 'hidden', marginBottom: '32px' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#f3e8ff', padding: '8px', borderRadius: '10px', color: '#9333ea' }}><Truck size={18} /></div>
              Vehicle Fleet Distance Rates & Specifications
            </h2>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>
              Configure vehicle classes with payload capacity (kg), cargo box dimensions (L × W × H cm), and distance rates.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Search size={16} />
              </span>
              <input 
                placeholder="Search classes..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '10px 16px 10px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', width: '180px', outline: 'none', background: '#fff' }}
                onFocus={e => e.target.style.borderColor = '#9333ea'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
            <div style={{ width: '1px', height: '24px', background: '#cbd5e1', margin: '0 4px' }} />
            <input 
              placeholder="New Class Name..." 
              value={newVehicle}
              onChange={e => setNewVehicle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddVehicle()}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', width: '160px', outline: 'none', background: '#f8fafc' }}
              onFocus={e => e.target.style.borderColor = '#9333ea'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
            <button 
              type="button"
              onClick={handleAddVehicle}
              style={{ padding: '10px 18px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
              onMouseOver={e => e.currentTarget.style.background = '#7e22ce'}
              onMouseOut={e => e.currentTarget.style.background = '#9333ea'}
              title="Add class with standard defaults, or open detailed creator"
            >
              <Plus size={16} /> Add Class
            </button>
          </div>
        </div>

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '1060px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '230px' }}>
                  Vehicle Class
                </th>
                <th style={{ padding: '16px 12px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '120px' }}>
                  Capacity (kg)
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Max Weight</div>
                </th>
                <th style={{ padding: '16px 12px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '110px' }}>
                  Size L (cm)
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Length</div>
                </th>
                <th style={{ padding: '16px 12px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '110px' }}>
                  Size W (cm)
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Width</div>
                </th>
                <th style={{ padding: '16px 12px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '110px' }}>
                  Size H (cm)
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Height</div>
                </th>
                <th style={{ padding: '16px 14px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '135px' }}>
                  Per KM Rate
                  <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 500, textTransform: 'none' }}>Distance Fee</div>
                </th>
                <th style={{ padding: '16px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center', width: '120px' }}>
                  Status
                </th>
                <th style={{ padding: '16px 16px', width: '50px' }}></th>
              </tr>
            </thead>
            <tbody>
              {mergedRates.map((rate) => (
                <tr key={rate.vehicleType} style={{ borderTop: '1px solid #f1f5f9', opacity: rate.isActive ? 1 : 0.6, background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.3s' }}>
                  {/* Vehicle Class Name & Summary */}
                  <td style={{ padding: '18px 24px', fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: rate.isActive ? '#eff6ff' : '#e2e8f0', color: rate.isActive ? '#3b82f6' : '#94a3b8', padding: '10px', borderRadius: '12px', flexShrink: 0 }}>
                        <Truck size={18} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>{rate.vehicleType}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px', fontWeight: 500 }}>
                          <span style={{ color: '#0f172a', fontWeight: 700 }}>{rate.capacityKg || 0} kg</span> · {rate.cargoLengthCm || 0} × {rate.cargoWidthCm || 0} × {rate.cargoHeightCm || 0} cm
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Capacity (kg) */}
                  <td style={{ padding: '18px 12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input 
                        type="number" min="0" step="1" 
                        value={rate.capacityKg ?? ''} 
                        onChange={e => updateRate(rate.vehicleType, { capacityKg: e.target.value })} 
                        placeholder="0"
                        style={{ width: '100%', padding: '10px 30px 10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#9333ea'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
                        kg
                      </span>
                    </div>
                  </td>

                  {/* Size L (cm) */}
                  <td style={{ padding: '18px 12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input 
                        type="number" min="0" step="1" 
                        value={rate.cargoLengthCm ?? ''} 
                        onChange={e => updateRate(rate.vehicleType, { cargoLengthCm: e.target.value })} 
                        placeholder="L"
                        style={{ width: '100%', padding: '10px 28px 10px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#9333ea'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
                        cm
                      </span>
                    </div>
                  </td>

                  {/* Size W (cm) */}
                  <td style={{ padding: '18px 12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input 
                        type="number" min="0" step="1" 
                        value={rate.cargoWidthCm ?? ''} 
                        onChange={e => updateRate(rate.vehicleType, { cargoWidthCm: e.target.value })} 
                        placeholder="W"
                        style={{ width: '100%', padding: '10px 28px 10px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#9333ea'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
                        cm
                      </span>
                    </div>
                  </td>

                  {/* Size H (cm) */}
                  <td style={{ padding: '18px 12px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <input 
                        type="number" min="0" step="1" 
                        value={rate.cargoHeightCm ?? ''} 
                        onChange={e => updateRate(rate.vehicleType, { cargoHeightCm: e.target.value })} 
                        placeholder="H"
                        style={{ width: '100%', padding: '10px 28px 10px 10px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', outline: 'none', boxSizing: 'border-box' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#9333ea'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                      <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>
                        cm
                      </span>
                    </div>
                  </td>

                  {/* Per KM Rate */}
                  <td style={{ padding: '18px 14px' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                      <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                        {currencyCode === 'PHP' ? '₱' : currencyCode}
                      </span>
                      <input 
                        type="number" min="0" step="0.01" 
                        value={rate.pricePerKm} 
                        onChange={e => updateRate(rate.vehicleType, { pricePerKm: e.target.value })} 
                        style={{ width: '100%', padding: '10px 10px 10px 28px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s', outline: 'none', boxSizing: 'border-box' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                    </div>
                  </td>

                  {/* Status Toggle */}
                  <td style={{ padding: '18px 16px', textAlign: 'center' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: rate.isActive ? '#f0fdf4' : '#f1f5f9', border: rate.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '30px', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: rate.isActive ? '#15803d' : '#64748b' }}>
                        {rate.isActive ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={rate.isActive} 
                        onChange={e => updateRate(rate.vehicleType, { isActive: e.target.checked })} 
                        style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }} 
                      />
                    </label>
                  </td>

                  {/* Delete Button */}
                  <td style={{ padding: '18px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleRemoveVehicle(rate.vehicleType)}
                      title="Remove Class"
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseOver={e => e.currentTarget.style.background = '#fef2f2'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Add Vehicle Class Modal */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '20px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden', border: '1px solid #e2e8f0', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ background: '#f3e8ff', color: '#9333ea', padding: '8px', borderRadius: '10px' }}>
                  <Truck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#1e293b' }}>Add Vehicle Fleet Class</h3>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Define capacity and 3D cargo box dimensions</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', borderRadius: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleModalAddVehicle} style={{ padding: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Vehicle Class Name *
                </label>
                <input 
                  required
                  placeholder="e.g. 6 Wheeler Truck, Mini Van, Tricycle"
                  value={modalVehicleType}
                  onChange={e => {
                    setModalVehicleType(e.target.value);
                    const def = defaultSpecsFor(e.target.value);
                    setModalCapacityKg(String(def.capacityKg));
                    setModalCargoLengthCm(String(def.cargoLengthCm));
                    setModalCargoWidthCm(String(def.cargoWidthCm));
                    setModalCargoHeightCm(String(def.cargoHeightCm));
                    setModalPricePerKm(String(def.pricePerKm));
                  }}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Max Capacity (kg) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input 
                      type="number" min="1" step="1" required
                      value={modalCapacityKg}
                      onChange={e => setModalCapacityKg(e.target.value)}
                      style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    />
                    <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '12px', fontWeight: 700 }}>kg</span>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                    Per KM Rate ({currencyCode === 'PHP' ? '₱' : currencyCode}) *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>
                      {currencyCode === 'PHP' ? '₱' : currencyCode}
                    </span>
                    <input 
                      type="number" min="0" step="0.01" required
                      value={modalPricePerKm}
                      onChange={e => setModalPricePerKm(e.target.value)}
                      style={{ width: '100%', padding: '10px 12px 10px 28px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Box size={14} color="#6366f1" /> Cargo Bed Dimensions (cm)
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Size L (cm)</label>
                    <input 
                      type="number" min="10" step="1" required
                      value={modalCargoLengthCm}
                      onChange={e => setModalCargoLengthCm(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Size W (cm)</label>
                    <input 
                      type="number" min="10" step="1" required
                      value={modalCargoWidthCm}
                      onChange={e => setModalCargoWidthCm(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '4px' }}>Size H (cm)</label>
                    <input 
                      type="number" min="10" step="1" required
                      value={modalCargoHeightCm}
                      onChange={e => setModalCargoHeightCm(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box', outline: 'none', fontWeight: 600 }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  style={{ padding: '10px 18px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '14px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  style={{ padding: '10px 22px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
                >
                  Add Vehicle Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Package Size Classification Management */}
      {(activeView === 'sizes' || activeView === 'both') && (
      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(15,23,42,0.05)', overflow: 'hidden', marginBottom: '32px' }}>
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ background: '#eff6ff', padding: '8px', borderRadius: '10px', color: '#2563eb' }}><Box size={18} /></div>
              Product & Package Size Categories
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
              Configure maximum dimensions (cm) and weight (kg) for automatic parcel classification across checkout and courier verification.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>
                <Search size={16} />
              </span>
              <input 
                placeholder="Search sizes..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ padding: '10px 16px 10px 36px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', width: '180px', outline: 'none', background: '#fff' }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>
          </div>
        </div>

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '180px' }}>Category Tier</th>
                <th style={{ padding: '16px 20px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description & Range</th>
                <th style={{ padding: '16px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '110px' }}>Max Wt (kg)</th>
                <th style={{ padding: '16px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Max L (cm)</th>
                <th style={{ padding: '16px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Max W (cm)</th>
                <th style={{ padding: '16px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', width: '100px' }}>Max H (cm)</th>
                <th style={{ padding: '16px 24px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right', width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCategories.map((cat) => {
                const badgeColor = 
                  cat.code.includes('SMALL') ? { bg: '#ecfdf5', text: '#059669', border: '#a7f3d0' } :
                  cat.code.includes('MED') ? { bg: '#eff6ff', text: '#2563eb', border: '#bfdbfe' } :
                  cat.code.includes('LARGE') ? { bg: '#f5f3ff', text: '#7c3aed', border: '#ddd6fe' } :
                  cat.code.includes('EXTRA') || cat.code.includes('XL') ? { bg: '#fffbeb', text: '#d97706', border: '#fde68a' } :
                  cat.code.includes('OVERSIZED') ? { bg: '#fff1f2', text: '#e11d48', border: '#fecdd3' } :
                  { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

                return (
                  <tr key={cat.code} style={{ borderTop: '1px solid #f1f5f9', opacity: cat.isActive ? 1 : 0.6, background: cat.isActive ? '#fff' : '#f8fafc' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ 
                          fontSize: '12px', fontWeight: 800, padding: '3px 10px', borderRadius: '6px', 
                          background: badgeColor.bg, color: badgeColor.text, border: `1px solid ${badgeColor.border}` 
                        }}>
                          {cat.name}
                        </span>
                      </div>
                      <input
                        type="text"
                        value={cat.name || ''}
                        onChange={e => updateCategory(cat.code, { name: e.target.value })}
                        placeholder="Tier name (e.g. Small, Med, Large, XL)"
                        style={{ width: '100%', padding: '6px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 600, color: '#1e293b' }}
                      />
                      <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#94a3b8', marginTop: 3 }}>{cat.code}</div>
                    </td>
                    <td style={{ padding: '16px 20px' }}>
                      <input
                        type="text"
                        value={cat.description || ''}
                        onChange={e => updateCategory(cat.code, { description: e.target.value })}
                        placeholder="Description (e.g. Up to 10 kg | Max 40 × 30 × 20 cm - Shoeboxes, small electronics)"
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', color: '#334155', boxSizing: 'border-box' }}
                      />
                      <div style={{ marginTop: 4, fontSize: '12px', fontWeight: 600, color: '#64748b' }}>
                        📏 Calculated Range: <span style={{ color: '#0f172a' }}>Up to {cat.maxWeightKg || 0} kg</span> · <span style={{ color: '#0f172a' }}>Max {cat.maxLengthCm || 0} × {cat.maxWidthCm || 0} × {cat.maxHeightCm || 0} cm</span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={cat.maxWeightKg ?? ''}
                        onChange={e => updateCategory(cat.code, { maxWeightKg: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={cat.maxLengthCm ?? ''}
                        onChange={e => updateCategory(cat.code, { maxLengthCm: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={cat.maxWidthCm ?? ''}
                        onChange={e => updateCategory(cat.code, { maxWidthCm: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '16px 16px' }}>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={cat.maxHeightCm ?? ''}
                        onChange={e => updateCategory(cat.code, { maxHeightCm: e.target.value })}
                        style={{ width: '100%', padding: '8px 10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: cat.isActive ? '#f0fdf4' : '#f1f5f9', border: cat.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0', padding: '6px 14px', borderRadius: '30px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: cat.isActive ? '#15803d' : '#64748b' }}>
                          {cat.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <input
                          type="checkbox"
                          checked={cat.isActive}
                          onChange={e => updateCategory(cat.code, { isActive: e.target.checked })}
                          style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }}
                        />
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
