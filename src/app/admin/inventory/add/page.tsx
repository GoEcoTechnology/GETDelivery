'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin.module.css';
import { PackagePlus, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function AddProductPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [items, setItems] = useState<any[]>([{
    id: Date.now(),
    name: '',
    sku: '',
    category: '',
    unit: 'pcs',
    price: '',
    lowStockThreshold: 10,
  }]);

  const handleAddItem = () => {
    setItems([...items, {
      id: Date.now(),
      name: '',
      sku: '',
      category: '',
      unit: 'pcs',
      price: '',
      lowStockThreshold: 10,
    }]);
  };

  const handleRemoveItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: number, field: string, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    items.forEach(item => {
      if (!item.name.trim()) hasError = true;
    });
    if (hasError) {
      alert('Please fill out the Product Name for all rows.');
      return;
    }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const results = await Promise.all(
        items.map(item =>
          fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              sku: item.sku || undefined,
              category: item.category || undefined,
              unit: item.unit,
              price: item.price ? parseFloat(item.price) : undefined,
              lowStockThreshold: parseInt(item.lowStockThreshold) || 10,
            })
          })
        )
      );

      const allOk = results.every(r => r.ok);
      if (allOk) {
        alert(items.length + ' product(s) added successfully!');
        router.push('/admin/inventory');
      } else {
        alert('Some products failed to save. Please try again.');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button
          onClick={() => router.push('/admin/inventory')}
          style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', padding: 0 }}
        >
          <ArrowLeft size={16} /> Back to Inventory
        </button>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '8px 0 4px 0' }}>
          <PackagePlus size={28} color="#4f46e5" />
          Bulk Add Products
        </h1>
        <p style={{ margin: 0, color: '#64748b' }}>Add multiple new products to your inventory in one go.</p>
      </div>

      <form onSubmit={handleFormSubmit}>
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Products to Add</h3>
            <button
              type="button"
              onClick={handleAddItem}
              className={styles.btnSecondary}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
            >
              <Plus size={16} /> Add Product Row
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {items.map((item) => (
              <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 0.8fr', gap: '16px' }}>
                  <div>
                    <label className={styles.label}>Product Name *</label>
                    <input className={styles.inputField} required value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} placeholder="e.g. Solar Panel 550W" />
                  </div>
                  <div>
                    <label className={styles.label}>SKU</label>
                    <input className={styles.inputField} value={item.sku} onChange={e => handleItemChange(item.id, 'sku', e.target.value)} placeholder="SP-550W" />
                  </div>
                  <div>
                    <label className={styles.label}>Category</label>
                    <input className={styles.inputField} value={item.category} onChange={e => handleItemChange(item.id, 'category', e.target.value)} placeholder="Electronics" />
                  </div>
                  <div>
                    <label className={styles.label}>Unit</label>
                    <select className={styles.inputField} value={item.unit} onChange={e => handleItemChange(item.id, 'unit', e.target.value)}>
                      <option value="pcs">Pieces (pcs)</option>
                      <option value="kg">Kilograms (kg)</option>
                      <option value="boxes">Boxes</option>
                      <option value="pallets">Pallets</option>
                      <option value="liters">Liters</option>
                      <option value="meters">Meters</option>
                    </select>
                  </div>
                  <div>
                    <label className={styles.label}>Price</label>
                    <input type="number" className={styles.inputField} step="0.01" min="0" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={styles.label}>Low Stock Alert</label>
                    <input type="number" className={styles.inputField} min="0" value={item.lowStockThreshold} onChange={e => handleItemChange(item.id, 'lowStockThreshold', e.target.value)} />
                  </div>
                </div>
                <div style={{ paddingTop: '28px' }}>
                  <button type="button" onClick={() => handleRemoveItem(item.id)} disabled={items.length === 1} style={{ background: 'none', border: 'none', color: items.length === 1 ? '#cbd5e1' : '#ef4444', cursor: items.length === 1 ? 'not-allowed' : 'pointer', padding: '8px' }} title="Remove row">
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.btnPrimary} style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '8px', border: 'none' }}>
              <PackagePlus size={18} /> Review and Confirm
            </button>
          </div>
        </div>
      </form>

      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#ede9fe', color: '#4f46e5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <PackagePlus size={24} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Confirm Bulk Add Products</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>You are about to add <strong>{items.length}</strong> new product(s) to your inventory.</p>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
              {items.map((item, i) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: i < items.length - 1 ? '8px' : 0 }}>
                  <span style={{ color: '#64748b' }}>{i + 1}. {item.name || '(unnamed)'}</span>
                  <span style={{ fontWeight: 600 }}>{item.unit}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }} disabled={loading}>Go Back</button>
              <button onClick={handleSubmit} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#4f46e5', cursor: 'pointer', fontWeight: 600, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} disabled={loading}>
                {loading ? 'Adding...' : 'Confirm and Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
