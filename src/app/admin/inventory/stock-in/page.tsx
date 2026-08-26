'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin.module.css';

export default function StockInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    reference: '',
    remarks: ''
  });

  useEffect(() => {
    fetch('/api/products?limit=100') // In a real app with 1000s of products, use an async searchable select
      .then(res => res.json())
      .then(data => setProducts(data.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/inventory/stock-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          productId: parseInt(formData.productId)
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('Stock successfully added!');
        router.push('/admin/inventory');
      } else {
        alert(data.error || 'Failed to add stock');
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
        <h1>Stock In</h1>
        <p>Add new stock to an existing product.</p>
      </div>

      <div className={styles.card} style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <label style={labelStyle}>Select Product *</label>
            <select 
              style={inputStyle} 
              required 
              value={formData.productId}
              onChange={e => setFormData({...formData, productId: e.target.value})}
            >
              <option value="" disabled>-- Select a Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock} {p.unit})</option>
              ))}
            </select>
          </div>
          
          <div>
            <label style={labelStyle}>Quantity to Add *</label>
            <input 
              type="number"
              style={inputStyle} 
              required
              min="1"
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
            />
          </div>

          <div>
            <label style={labelStyle}>Supplier / Reference Code</label>
            <input 
              style={inputStyle} 
              value={formData.reference}
              onChange={e => setFormData({...formData, reference: e.target.value})}
              placeholder="e.g. PO-2026-001"
            />
          </div>

          <div>
            <label style={labelStyle}>Remarks</label>
            <textarea 
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} 
              value={formData.remarks}
              onChange={e => setFormData({...formData, remarks: e.target.value})}
              placeholder="Optional notes about this shipment"
            />
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
              disabled={loading || !formData.productId}
              style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: '#10b981', color: 'white', cursor: loading || !formData.productId ? 'not-allowed' : 'pointer', fontWeight: 600, flex: 1 }}
            >
              {loading ? 'Processing...' : 'Confirm Stock In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 500, color: '#334155' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', backgroundColor: '#fff' };
