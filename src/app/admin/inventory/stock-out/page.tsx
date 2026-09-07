'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../../admin/admin.module.css';
import { ArrowUpRight, PackageOpen, AlertCircle, Plus, Trash2, ArrowLeft } from 'lucide-react';

export default function StockOutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const draftKey = 'stock-out-form-draft';
  
  const [reason, setReason] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.reason || '';
      }
    } catch {}
    return '';
  });
  const [date, setDate] = useState(() => {
    if (typeof window === 'undefined') return new Date().toISOString().slice(0, 16);
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.date || new Date().toISOString().slice(0, 16);
      }
    } catch {}
    return new Date().toISOString().slice(0, 16);
  });
  
  const [items, setItems] = useState<any[]>(() => {
    if (typeof window === 'undefined') return [{
      id: Date.now(),
      productId: '',
      quantity: '',
      notes: ''
    }];

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items) && parsed.items.length > 0) return parsed.items;
      }
    } catch {}

    return [{
      id: Date.now(),
      productId: '',
      quantity: '',
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
      localStorage.setItem(draftKey, JSON.stringify({ reason, date, items }));
    }
  }, [reason, date, items, draftKey]);

  const handleAddItem = () => {
    setItems([...items, { id: Date.now(), productId: '', quantity: '', notes: '' }]);
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
        notes: item.notes
      }));

      const payload = {
        items: payloadItems,
        reason,
        date: date ? new Date(date).toISOString() : undefined
      };

      const res = await fetch('/api/inventory/stock-out', {
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
        alert('Stock successfully removed!');
        router.push('/admin/inventory');
      } else {
        alert(data.error || 'Failed to remove stock');
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
    if (!reason.trim()) {
      alert('Please provide an overall reason for the stock out.');
      return;
    }
    
    let hasError = false;
    let hasExceededStock = false;
    
    // Validate items
    const selectedProductIds = new Set();
    
    items.forEach(item => {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        hasError = true;
      }
      
      const product = products.find(p => p.id.toString() === item.productId);
      if (product && item.quantity > product.stock) {
        hasExceededStock = true;
      }
    });

    if (hasError) {
      alert('Please fill out product and quantity for all rows.');
      return;
    }
    
    if (hasExceededStock) {
      alert('One or more products exceed the available stock limit.');
      return;
    }

    setShowConfirm(true);
  };

  const totalQuantity = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);

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
          <PackageOpen size={28} color="#ef4444" />
          Bulk Stock Out
        </h1>
        <p style={{ margin: 0, color: '#64748b' }}>Record multiple inventory items taken out in a single transaction.</p>
      </div>

      <form onSubmit={handleFormSubmit}>
        {/* Transaction Header */}
        <div className={styles.card} style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Transaction Details
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div>
              <label className={styles.label}>Overall Reason *</label>
              <input 
                type="text"
                className={styles.inputField} 
                required
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="e.g., Damaged during transport, Inventory adjustment"
              />
            </div>
            <div>
              <label className={styles.label}>Date & Time *</label>
              <input 
                type="datetime-local"
                className={styles.inputField} 
                required
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Product Items */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Products to Stock Out</h3>
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
              const isOverStock = selectedProduct && item.quantity > selectedProduct.stock;
              
              return (
                <div key={item.id} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '2fr 1fr 2fr', gap: '16px' }}>
                    
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
                          Available: <strong style={{ color: '#0f172a' }}>{selectedProduct.stock} {selectedProduct.unit}</strong>
                          {selectedProduct.category && ` | ${selectedProduct.category}`}
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
                        max={selectedProduct ? selectedProduct.stock : undefined}
                        value={item.quantity}
                        onChange={e => handleItemChange(item.id, 'quantity', e.target.value === '' ? '' : e.target.value)}
                        placeholder="Qty"
                        style={{ borderColor: isOverStock ? '#ef4444' : undefined }}
                      />
                      {isOverStock && (
                        <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <AlertCircle size={12} /> Exceeds stock
                        </div>
                      )}
                    </div>
                    
                    {/* Remarks */}
                    <div>
                      <label className={styles.label}>Remarks (Optional)</label>
                      <input 
                        type="text"
                        className={styles.inputField} 
                        value={item.notes}
                        onChange={e => handleItemChange(item.id, 'notes', e.target.value)}
                        placeholder="Notes for this item..."
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
              style={{ flex: 1, backgroundColor: '#ef4444', display: 'flex', justifyContent: 'center', gap: '8px' }}
            >
              <ArrowUpRight size={18} />
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
              <div style={{ width: '48px', height: '48px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <AlertCircle size={24} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>Confirm Bulk Stock Out</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                You are about to deduct stock for <strong>{items.length}</strong> product(s).
              </p>
            </div>
            
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Reason:</span>
                <span style={{ fontWeight: 600 }}>{reason}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#64748b' }}>Total Products:</span>
                <span style={{ fontWeight: 600 }}>{items.length} items</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Total Quantity:</span>
                <span style={{ fontWeight: 600, color: '#ef4444' }}>-{totalQuantity} units</span>
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
                style={{ flex: 1, padding: '12px', borderRadius: '8px', border: 'none', background: '#ef4444', cursor: 'pointer', fontWeight: 600, color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Confirm Stock Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
