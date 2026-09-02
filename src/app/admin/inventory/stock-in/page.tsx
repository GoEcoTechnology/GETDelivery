'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../admin/admin.module.css';
import { ArrowDownToLine, PackageOpen, AlertCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function StockInPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const draftKey = 'stock-in-form-draft';
  
  const [items, setItems] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [{
      id: Date.now(),
      productId: '',
      quantity: '',
      unitCost: '',
      supplier: '',
      notes: ''
    }];

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // Ignore malformed saved draft
    }

    return [{
      id: Date.now(),
      productId: '',
      quantity: '',
      unitCost: '',
      supplier: '',
      notes: ''
    }];
  });

  useEffect(() => {
    fetch('/api/products?limit=1000', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
    }) 
      .then(res => res.json())
      .then(data => setProducts(data.data || []));
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(draftKey, JSON.stringify(items));
    }
  }, [items, draftKey]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), productId: '', quantity: '', unitCost: '', supplier: '', notes: '' }]);
  };

  const handleRemoveItem = (id: number) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const handleItemChange = (id: number, field: string, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const payloadItems = items.map(item => ({
        productId: parseInt(item.productId),
        quantity: parseInt(item.quantity),
        unitCost: item.unitCost ? parseFloat(item.unitCost) : undefined,
        supplier: item.supplier || undefined,
        notes: item.notes || undefined
      }));

      const payload = {
        items: payloadItems
      };

      const res = await fetch('/api/inventory/transaction', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (res.ok) {
        localStorage.removeItem(draftKey);
        alert('Stock successfully added!');
        router.push('/admin/inventory');
      } else {
        alert(data.error || 'Failed to add stock');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let hasError = false;
    
    items.forEach(item => {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        hasError = true;
      }
    });

    if (hasError) {
      alert('Please fill out product and valid quantity for all rows.');
      return;
    }
    
    setShowConfirm(true);
  };

  const totalQuantity = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <button 
            onClick={() => router.push('/admin/inventory')}
            style={{ background: 'none', border: 'none', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '8px', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back to Inventory
          </button>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ArrowDownToLine size={28} color="#16a34a" />
            Bulk Stock In
          </h1>
          <p>Add multiple products to your inventory in a single transaction.</p>
        </div>
      </div>

      <form onSubmit={handleFormSubmit}>
        {/* Product Items */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Products to Stock In</h3>
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
            {items.map((item, index) => {
              const selectedProduct = products.find(p => p.id.toString() === item.productId);
              
              return (
                <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr', gap: '16px' }}>
                    
                    {/* Product Selection */}
                    <div>
                      <label className={styles.label}>Product *</label>
                      <select 
                        className={styles.inputField} 
                        required 
                        value={item.productId}
                        onChange={e => handleItemChange(item.id, 'productId', e.target.value)}
                      >
                        <option value="" disabled>-- Select Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.sku ? `(${p.sku})` : ''} - {p.stock} {p.unit} avail.
                          </option>
                        ))}
                      </select>
                      {selectedProduct && (
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                          Current Stock: <strong style={{ color: '#0f172a' }}>{selectedProduct.stock} {selectedProduct.unit}</strong>
                        </div>
                      )}
                    </div>
                    
                    {/* Quantity */}
                    <div>
                      <label className={styles.label}>Quantity *</label>
                      <input 
                        type="number"
                        className={styles.inputField} 
                        min="1"
                        value={item.quantity}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value === '' ? '' : e.target.value)}
                        placeholder="Qty"
                      />
                    </div>

                    {/* Unit Cost */}
                    <div>
                      <label className={styles.label}>Unit Cost</label>
                      <input 
                        type="number"
                        className={styles.inputField} 
                        step="0.01"
                        min="0"
                        value={item.unitCost}
                        onChange={e => handleItemChange(item.id, 'unitCost', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>

                    {/* Supplier */}
                    <div>
                      <label className={styles.label}>Supplier</label>
                      <input 
                        type="text"
                        className={styles.inputField} 
                        value={item.supplier}
                        onChange={e => handleItemChange(item.id, 'supplier', e.target.value)}
                        placeholder="Supplier name"
                      />
                    </div>
                    
                    {/* Remarks */}
                    <div>
                      <label className={styles.label}>Remarks</label>
                      <input 
                        type="text"
                        className={styles.inputField} 
                        value={item.notes}
                        onChange={e => handleItemChange(item.id, 'notes', e.target.value)}
                        placeholder="Optional notes"
                      />
                    </div>
                  </div>
                  
                  {/* Remove Button */}
                  <div style={{ paddingTop: '28px' }}>
                    <button 
                      type="button" 
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={items.length === 1}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: items.length === 1 ? '#cbd5e1' : '#ef4444', 
                        cursor: items.length === 1 ? 'not-allowed' : 'pointer',
                        padding: '8px'
                      }}
                      title="Remove row"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #e2e8f0' }}>
            <button 
              type="button" 
              onClick={() => router.back()}
              style={{ padding: '12px 24px', borderRadius: '10px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || items.length === 0}
              className={styles.btnPrimary}
              style={{ flex: 1, backgroundColor: '#16a34a', display: 'flex', justifyContent: 'center', gap: '8px', border: 'none' }}
            >
              <ArrowDownToLine size={18} />
              Review & Confirm
            </button>
          </div>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', maxWidth: '500px', width: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ArrowDownToLine size={24} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Confirm Bulk Stock In</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                You are about to add stock for <strong>{items.length}</strong> product(s).
              </p>
            </div>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Total Products:</span>
                <span style={{ fontWeight: 600 }}>{items.length} items</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Total Quantity:</span>
                <span style={{ fontWeight: 600, color: '#16a34a' }}>+{totalQuantity} units</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowConfirm(false)}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569' }}
                disabled={loading}
              >
                Go Back
              </button>
              <button 
                onClick={handleSubmit}
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#16a34a', cursor: 'pointer', fontWeight: 600, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Stock In'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
