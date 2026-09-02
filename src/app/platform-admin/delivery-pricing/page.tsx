'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from '../../admin/admin.module.css';
import { Save, Truck } from 'lucide-react';

type RateRow = { vehicleType: string; basePrice: string | number; isActive: boolean };

export default function DeliveryPricingPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState('PHP');
  const [pricePerKm, setPricePerKm] = useState('20');
  const [rates, setRates] = useState<RateRow[]>([]);
  const [vehicleTypes, setVehicleTypes] = useState<string[]>([]);

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
    return vehicleTypes.length > 0
      ? vehicleTypes.map(type => map.get(type) || { vehicleType: type, basePrice: '0', isActive: true })
      : rates;
  }, [rates, vehicleTypes]);

  const updateRate = (vehicleType: string, patch: Partial<RateRow>) => {
    setRates(prev => {
      const existing = prev.find(r => r.vehicleType === vehicleType);
      if (!existing) return [...prev, { vehicleType, basePrice: '0', isActive: true, ...patch }];
      return prev.map(r => r.vehicleType === vehicleType ? { ...r, ...patch } : r);
    });
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
          rates: mergedRates.map(r => ({ vehicleType: r.vehicleType, basePrice: Number(r.basePrice || 0), isActive: r.isActive })),
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
    <div>
      <div className={styles.header}>
        <h1>Delivery Pricing</h1>
        <p>Set base vehicle rates and per-kilometer pricing for broadcasts.</p>
      </div>

      <div className={styles.card} style={{ padding: '24px', borderRadius: '18px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          <div>
            <label className={styles.label}>Currency</label>
            <input className={styles.inputField} value={currencyCode} onChange={e => setCurrencyCode(e.target.value.toUpperCase())} />
          </div>
          <div>
            <label className={styles.label}>Price per Kilometer</label>
            <input className={styles.inputField} type="number" min="0" step="0.01" value={pricePerKm} onChange={e => setPricePerKm(e.target.value)} />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Vehicle Type</th>
                <th>Base Price</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mergedRates.map(rate => (
                <tr key={rate.vehicleType}>
                  <td style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}><Truck size={16} />{rate.vehicleType}</td>
                  <td><input className={styles.inputField} type="number" min="0" step="0.01" value={rate.basePrice} onChange={e => updateRate(rate.vehicleType, { basePrice: e.target.value })} /></td>
                  <td>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                      <input type="checkbox" checked={rate.isActive} onChange={e => updateRate(rate.vehicleType, { isActive: e.target.checked })} />
                      Active
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button className={styles.btnPrimary} onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Save size={16} /> {saving ? 'Saving...' : 'Save Pricing'}
          </button>
        </div>
      </div>
    </div>
  );
}
