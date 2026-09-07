'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { Save, Truck, Plus, DollarSign, Activity } from 'lucide-react';

type RateRow = { vehicleType: string; basePrice: string | number; pricePerKm: string | number; isActive: boolean };

export default function DeliveryPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('PHP');
  const [pricePerKm, setPricePerKm] = useState('20');
  const [rates, setRates] = useState<RateRow[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);
  const [newVehicle, setNewVehicle] = useState('');

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/platform-admin/delivery-pricing', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setCurrencyCode(json.data?.settings?.currencyCode || 'PHP');
        setPricePerKm(String(json.data?.settings?.pricePerKm || '20'));
        setRates(json.data?.rates || []);
        setVehicleTypes((json.data?.vehicleTypes || []).map((v: { vehicleType: string }) => v.vehicleType));
      }
      setLoading(false);
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
    if (newVehicle.trim() && !mergedRates.some(r => r.vehicleType.toLowerCase() === newVehicle.trim().toLowerCase())) {
      setRates(prev => [...prev, { vehicleType: newVehicle.trim(), basePrice: '0', pricePerKm: '0', isActive: true }]);
      setNewVehicle('');
    }
  };

  const handleSave = async () => {
    setSaving(true);
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
          rates: mergedRates.map(r => ({ 
            vehicleType: r.vehicleType, 
            basePrice: Number(r.basePrice || 0), 
            pricePerKm: Number(r.pricePerKm || 0),
            isActive: r.isActive 
          })),
        })
      });
      if (!res.ok) throw new Error('Failed to save pricing');
      alert('Pricing saved successfully');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Failed to save pricing');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className={styles.loading}>Loading pricing...</div>;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '16px' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>Platform Pricing Settings</h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '15px' }}>Configure global settings and specialized per-vehicle delivery rates.</p>
      </div>

      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15,23,42,0.04)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Global Settings Section */}
        <div style={{ padding: '24px 32px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={16} /> Global Parameters
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Currency Code</label>
              <input 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff', outline: 'none', transition: 'border 0.2s' }} 
                value={currencyCode} 
                onChange={e => setCurrencyCode(e.target.value.toUpperCase())} 
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>Global Price per KM (Fallback)</label>
              <input 
                style={{ width: '100%', padding: '12px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#fff', outline: 'none', transition: 'border 0.2s' }} 
                type="number" min="0" step="0.01" 
                value={pricePerKm} 
                onChange={e => setPricePerKm(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* Vehicle Pricing Section */}
        <div style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Vehicle-Specific Rates</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                placeholder="New Vehicle Type..." 
                value={newVehicle}
                onChange={e => setNewVehicle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddVehicle()}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', flex: '1 1 150px', minWidth: 0, maxWidth: '200px' }}
              />
              <button 
                onClick={handleAddVehicle}
                style={{ padding: '8px 16px', background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="table-responsive-wrapper">
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle Class</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Price</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price per KM</th>
                  <th style={{ padding: '16px', fontWeight: 600, color: '#64748b', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {mergedRates.map((rate, idx) => (
                  <tr key={rate.vehicleType} style={{ borderBottom: idx < mergedRates.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '16px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ background: '#eff6ff', color: '#3b82f6', padding: '6px', borderRadius: '6px' }}><Truck size={14} /></div>
                      {rate.vehicleType}
                    </td>
                    <td style={{ padding: '16px' }}>
                      <input 
                        type="number" min="0" step="0.01" 
                        value={rate.basePrice} 
                        onChange={e => updateRate(rate.vehicleType, { basePrice: e.target.value })} 
                        style={{ width: '100px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                      />
                    </td>
                    <td style={{ padding: '16px' }}>
                      <input 
                        type="number" min="0" step="0.01" 
                        value={rate.pricePerKm} 
                        onChange={e => updateRate(rate.vehicleType, { pricePerKm: e.target.value })} 
                        style={{ width: '100px', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' }}
                      />
                    </td>
                    <td style={{ padding: '16px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: rate.isActive ? '#f0fdf4' : '#f8fafc', border: rate.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px' }}>
                        <input type="checkbox" checked={rate.isActive} onChange={e => updateRate(rate.vehicleType, { isActive: e.target.checked })} style={{ accentColor: '#16a34a' }} />
                        <span style={{ fontSize: '13px', fontWeight: 600, color: rate.isActive ? '#15803d' : '#64748b' }}>
                          {rate.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Save Actions */}
        <div style={{ padding: '20px 32px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            onClick={handleSave} 
            disabled={saving} 
            style={{ 
              display: 'inline-flex', alignItems: 'center', gap: '8px', 
              background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', 
              padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1, transition: 'background 0.2s'
            }}
          >
            <Save size={16} /> {saving ? 'Applying Configuration...' : 'Save Pricing Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}
