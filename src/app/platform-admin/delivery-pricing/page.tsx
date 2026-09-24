'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Truck, Plus, DollarSign, Activity, Settings, Zap, CheckCircle2 } from 'lucide-react';

type RateRow = { vehicleType: string; basePrice: string | number; pricePerKm: string | number; isActive: boolean };

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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/platform-admin/delivery-pricing', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
        });
        if (res.ok) {
          const json = await res.json();
          setCurrencyCode(json.data?.settings?.currencyCode || 'PHP');
          setPricePerKm(String(json.data?.settings?.pricePerKm || '20'));
          setUrgentDeliveryFee(String(json.data?.settings?.urgentDeliveryFee || '50'));
          setRates(json.data?.rates || []);
          setVehicleTypes((json.data?.vehicleTypes || []).map((v: { vehicleType: string }) => v.vehicleType));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const mergedRates = useMemo(() => {
    const map = new Map(rates.map(r => [r.vehicleType, r]));
    vehicleTypes.forEach(type => {
      if (!map.has(type)) {
        map.set(type, { vehicleType: type, basePrice: '0', pricePerKm: '0', isActive: true });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.vehicleType.localeCompare(b.vehicleType));
  }, [rates, vehicleTypes]);

  const updateRate = (vehicleType: string, patch: Partial<RateRow>) => {
    setRates(prev => {
      const existing = prev.find(r => r.vehicleType === vehicleType);
      if (!existing) return [...prev, { vehicleType, basePrice: '0', pricePerKm: '0', isActive: true, ...patch }];
      return prev.map(r => r.vehicleType === vehicleType ? { ...r, ...patch } : r);
    });
  };

  const handleAddVehicle = () => {
    const trimmed = newVehicle.trim();
    if (trimmed && !mergedRates.some(r => r.vehicleType.toLowerCase() === trimmed.toLowerCase())) {
      setRates(prev => [...prev, { vehicleType: trimmed, basePrice: '0', pricePerKm: '0', isActive: true }]);
      setNewVehicle('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/platform-admin/delivery-pricing', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          currencyCode,
          pricePerKm: Number(pricePerKm),
          urgentDeliveryFee: Number(urgentDeliveryFee),
          rates: mergedRates.map(r => ({ 
            vehicleType: r.vehicleType, 
            basePrice: Number(r.basePrice || 0), 
            pricePerKm: Number(r.pricePerKm || 0),
            isActive: r.isActive 
          })),
        })
      });
      if (!res.ok) throw new Error('Failed to save pricing');
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save pricing');
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
          <h3 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative', zIndex: 1 }}><DollarSign size={24} color="#38bdf8" /> Pricing Structure</h3>
          <p style={{ color: '#94a3b8', lineHeight: 1.6, margin: 0, fontSize: '15px', position: 'relative', zIndex: 1 }}>
            Base prices apply immediately upon vehicle selection, and the Per KM Rate is applied based on distance.
          </p>
        </div>
      </div>

      {/* Vehicle Pricing Section */}
      <div style={{ background: '#fff', borderRadius: '20px', border: '1px solid #e2e8f0', boxShadow: '0 10px 40px -10px rgba(15,23,42,0.05)', overflow: 'hidden' }}>
        
        <div style={{ padding: '24px 32px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#f3e8ff', padding: '8px', borderRadius: '10px', color: '#9333ea' }}><Truck size={18} /></div>
            Vehicle-Specific Rates
          </h2>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input 
              placeholder="E.g. Refrigerated Van" 
              value={newVehicle}
              onChange={e => setNewVehicle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddVehicle()}
              style={{ padding: '10px 16px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '14px', width: '220px', outline: 'none', background: '#f8fafc', flex: '1 1 160px' }}
              onFocus={e => e.target.style.borderColor = '#9333ea'}
              onBlur={e => e.target.style.borderColor = '#cbd5e1'}
            />
            <button 
              type="button"
              onClick={handleAddVehicle}
              style={{ padding: '10px 20px', background: '#9333ea', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s', whiteSpace: 'nowrap' }}
              onMouseOver={e => e.currentTarget.style.background = '#7e22ce'}
              onMouseOut={e => e.currentTarget.style.background = '#9333ea'}
            >
              <Plus size={16} /> Add Class
            </button>
          </div>
        </div>

        <div className="table-responsive-wrapper" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: '16px 32px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle Class</th>
                <th style={{ padding: '16px 32px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Price</th>
                <th style={{ padding: '16px 32px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Per KM Rate</th>
                <th style={{ padding: '16px 32px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {mergedRates.map((rate, idx) => (
                <tr key={rate.vehicleType} style={{ borderTop: '1px solid #f1f5f9', opacity: rate.isActive ? 1 : 0.6, background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.3s' }}>
                  <td style={{ padding: '20px 32px', fontWeight: 600, color: '#1e293b', fontSize: '15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ background: rate.isActive ? '#eff6ff' : '#e2e8f0', color: rate.isActive ? '#3b82f6' : '#94a3b8', padding: '10px', borderRadius: '12px' }}>
                        <Truck size={18} />
                      </div>
                      {rate.vehicleType}
                    </div>
                  </td>
                  <td style={{ padding: '20px 32px' }}>
                    <div style={{ position: 'relative', width: '160px' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>{currencyCode === 'PHP' ? '₱' : currencyCode}</span>
                      <input 
                        type="number" min="0" step="0.01" 
                        value={rate.basePrice} 
                        onChange={e => updateRate(rate.vehicleType, { basePrice: e.target.value })} 
                        style={{ width: '100%', padding: '12px 14px 12px 32px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s', outline: 'none' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '20px 32px' }}>
                    <div style={{ position: 'relative', width: '160px' }}>
                      <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '14px', fontWeight: 600 }}>{currencyCode === 'PHP' ? '₱' : currencyCode}</span>
                      <input 
                        type="number" min="0" step="0.01" 
                        value={rate.pricePerKm} 
                        onChange={e => updateRate(rate.vehicleType, { pricePerKm: e.target.value })} 
                        style={{ width: '100%', padding: '12px 14px 12px 32px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '15px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s', outline: 'none' }}
                        disabled={!rate.isActive}
                        onFocus={e => e.target.style.borderColor = '#3b82f6'}
                        onBlur={e => e.target.style.borderColor = '#cbd5e1'}
                      />
                    </div>
                  </td>
                  <td style={{ padding: '20px 32px', textAlign: 'right' }}>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: rate.isActive ? '#f0fdf4' : '#f1f5f9', border: rate.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '30px', transition: 'all 0.2s' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: rate.isActive ? '#15803d' : '#64748b' }}>
                        {rate.isActive ? 'Active' : 'Disabled'}
                      </span>
                      <input 
                        type="checkbox" 
                        checked={rate.isActive} 
                        onChange={e => updateRate(rate.vehicleType, { isActive: e.target.checked })} 
                        style={{ accentColor: '#16a34a', width: '18px', height: '18px', cursor: 'pointer', margin: 0 }} 
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
