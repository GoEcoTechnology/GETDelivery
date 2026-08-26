'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../admin/admin.module.css';
import { ArrowUpRight } from 'lucide-react';

export default function StockOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    productId: '',
    quantity: 0,
    reference: ''
  });

  useEffect(() => {
    fetch('/api/products?limit=1000') 
      .then(res => res.json())
      .then(data => setProducts(data.data || []));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/inventory/stock-out', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify({
          items: [{
            productId: parseInt(formData.productId),
            quantity: formData.quantity
          }],
          reference: formData.reference
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        alert('Stock successfully removed!');
        router.push('/admin/inventory');
      } else {
        alert(data.error || 'Failed to remove stock');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id.toString() === formData.productId);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Stock Out</h1>
          <p>Remove stock due to damage, spoilage, or manual corrections</p>
        </div>
      </div>

      <div className={styles.card} style={{ maxWidth: '600px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div>
            <label className={styles.label}>Select Product *</label>
            <select 
              className={styles.inputField} 
              required 
              value={formData.productId}
              onChange={e => setFormData({...formData, productId: e.target.value})}
            >
              <option value="" disabled>-- Select a Product --</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Current Stock: {p.stock} {p.unit})</option>
              ))}
            </select>
            {selectedProduct && (
              <p style={{ fontSize: '13px', color: '#64748b', marginTop: '8px' }}>
                Available to remove: <span style={{ fontWeight: 700, color: '#1e293b' }}>{selectedProduct.stock} {selectedProduct.unit}</span>
              </p>
            )}
          </div>
          
          <div>
            <label className={styles.label}>Quantity to Remove *</label>
            <input 
              type="number"
              className={styles.inputField} 
              required
              min="1"
              max={selectedProduct ? selectedProduct.stock : undefined}
              value={formData.quantity}
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
            />
          </div>

          <div>
            <label className={styles.label}>Reason / Reference Code</label>
            <input 
              className={styles.inputField} 
              value={formData.reference}
              onChange={e => setFormData({...formData, reference: e.target.value})}
              placeholder="e.g. Spoilage, Damage, Order #123"
            />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button 
              type="button" 
              onClick={() => router.back()}
              style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || !formData.productId || formData.quantity <= 0}
              className={styles.btnPrimary}
              style={{ flex: 1, backgroundColor: '#ef4444', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <ArrowUpRight size={18} />
              {loading ? 'Processing...' : 'Confirm Stock Out'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
