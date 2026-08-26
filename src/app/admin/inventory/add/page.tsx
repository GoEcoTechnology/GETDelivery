'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin.module.css';

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    lowStockThreshold: 10,
    price: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      
      if (res.ok) {
        router.push('/admin/inventory');
      } else {
        alert(data.error || 'Failed to add product');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className={styles.header}>
        <h1>Add New Product</h1>
        <p>Create a new product in your inventory master list.</p>
      </div>

      <div className={styles.card} style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Product Name *</label>
            <input 
              style={inputStyle} 
              required 
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g. Solar Panel 550W"
            />
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>SKU (Optional)</label>
              <input 
                style={inputStyle} 
                value={formData.sku}
                onChange={e => setFormData({...formData, sku: e.target.value})}
                placeholder="SP-550W"
              />
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <input 
                style={inputStyle} 
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                placeholder="Electronics"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label style={labelStyle}>Unit of Measure</label>
              <select 
                style={inputStyle} 
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="kg">Kilograms (kg)</option>
                <option value="boxes">Boxes</option>
                <option value="pallets">Pallets</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Low Stock Alert Threshold</label>
              <input 
                type="number"
                style={inputStyle} 
                value={formData.lowStockThreshold}
                onChange={e => setFormData({...formData, lowStockThreshold: parseInt(e.target.value) || 0})}
                min="0"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button 
              type="button" 
              onClick={() => router.back()}
              style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', cursor: 'pointer', fontWeight: 500 }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading}
              style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#2563eb', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, flex: 1 }}
            >
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px' };
