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

      <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(15,23,42,0.04)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        


        {/* Vehicle Pricing Section */}
        <div style={{ padding: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Vehicle-Specific Rates</h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: '1 1 auto', justifyContent: 'flex-end' }}>
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

          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
            <div className="table-responsive-wrapper" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle Class</th>
                    <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Base Price</th>
                    <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price per KM</th>
                    <th style={{ padding: '16px', fontWeight: 700, color: '#475569', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedRates.map((rate, idx) => (
                    <tr key={rate.vehicleType} style={{ borderBottom: idx < mergedRates.length - 1 ? '1px solid #f1f5f9' : 'none', opacity: rate.isActive ? 1 : 0.7, background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s' }}>
                      <td style={{ padding: '16px', fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: rate.isActive ? '#eff6ff' : '#e2e8f0', color: rate.isActive ? '#3b82f6' : '#64748b', padding: '8px', borderRadius: '8px' }}>
                          <Truck size={16} />
                        </div>
                        {rate.vehicleType}
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ position: 'relative', width: '140px' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>₱</span>
                          <input 
                            type="number" min="0" step="0.01" 
                            value={rate.basePrice} 
                            onChange={e => updateRate(rate.vehicleType, { basePrice: e.target.value })} 
                            style={{ width: '100%', padding: '10px 10px 10px 26px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                            disabled={!rate.isActive}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <div style={{ position: 'relative', width: '140px' }}>
                          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '13px', fontWeight: 600 }}>₱</span>
                          <input 
                            type="number" min="0" step="0.01" 
                            value={rate.pricePerKm} 
                            onChange={e => updateRate(rate.vehicleType, { pricePerKm: e.target.value })} 
                            style={{ width: '100%', padding: '10px 10px 10px 26px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', fontWeight: 600, color: '#0f172a', background: rate.isActive ? '#fff' : '#f8fafc', transition: 'all 0.2s', outline: 'none', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)' }}
                            disabled={!rate.isActive}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: rate.isActive ? '#f0fdf4' : '#f1f5f9', border: rate.isActive ? '1px solid #bbf7d0' : '1px solid #e2e8f0', padding: '6px 12px', borderRadius: '20px', transition: 'all 0.2s' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: rate.isActive ? '#15803d' : '#64748b' }}>
                            {rate.isActive ? 'Active' : 'Disabled'}
                          </span>
                          <input type="checkbox" checked={rate.isActive} onChange={e => updateRate(rate.vehicleType, { isActive: e.target.checked })} style={{ accentColor: '#16a34a', width: '16px', height: '16px', cursor: 'pointer', margin: 0 }} />
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
