'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from '../../admin.module.css';

export default function CreateDeliveryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    customerId: '',
    customerName: '',
    customerContact: '',
    pickupAddress: '',
    dropoffAddress: '',
    deliveryDate: '',
    instructions: ''
  });

  const [items, setItems] = useState<{productId: string, quantity: number, unit: string}[]>([]);

  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/products?limit=100').then(res => res.json()).then(data => setProducts(data.data || []));
    fetch('/api/customers?limit=100').then(res => res.json()).then(data => setCustomers(data.data || []));
  }, []);

  const handleCustomerSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const customerId = e.target.value;
    const selected = customers.find(c => c.id.toString() === customerId);
    if (selected) {
      setFormData({
        ...formData,
        customerId: selected.id,
        customerName: selected.name,
        customerContact: selected.mobileNumber,
        dropoffAddress: `${selected.address}, ${selected.barangay || ''}, ${selected.municipality || ''}`.replace(/,\s*,/g, ',').replace(/,\s*$/, '')
      });
    }
  };

  const handleAddItem = () => {
    setItems([...items, { productId: '', quantity: 1, unit: 'pcs' }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('You must add at least one item to deliver');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/deliveries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items
        })
      });
      const data = await res.json();
      
      if (res.ok) {
        router.push('/admin/deliveries');
      } else {
        alert(data.error || 'Failed to create delivery');
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
        <h1>Create Delivery Order</h1>
        <p>Schedule a new delivery and assign inventory items.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Delivery Details */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Delivery Details</h3>
          
          <div>
            <label style={labelStyle}>Select Customer *</label>
            <select style={inputStyle} required onChange={handleCustomerSelect} value={(formData as any).customerId || ''}>
              <option value="" disabled>Select a saved customer</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Customer Name *</label>
              <input style={inputStyle} required value={formData.customerName} onChange={e => setFormData({...formData, customerName: e.target.value})} />
            </div>
            <div>
              <label style={labelStyle}>Contact Number *</label>
              <input style={inputStyle} required value={formData.customerContact} onChange={e => setFormData({...formData, customerContact: e.target.value})} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Pickup Address *</label>
            <input style={inputStyle} required value={formData.pickupAddress} onChange={e => setFormData({...formData, pickupAddress: e.target.value})} />
          </div>

          <div>
            <label style={labelStyle}>Drop-off Address *</label>
            <input style={inputStyle} required value={formData.dropoffAddress} onChange={e => setFormData({...formData, dropoffAddress: e.target.value})} />
          </div>

          <div>
            <label style={labelStyle}>Delivery Date & Time *</label>
            <input type="datetime-local" required style={inputStyle} value={formData.deliveryDate} onChange={e => setFormData({...formData, deliveryDate: e.target.value})} />
          </div>

          <div>
            <label style={labelStyle}>Delivery Instructions</label>
            <textarea style={{...inputStyle, height: '80px'}} value={formData.instructions} onChange={e => setFormData({...formData, instructions: e.target.value})} />
          </div>
        </div>

        {/* Right Column: Inventory Items */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Inventory Items</h3>
            <button type="button" onClick={handleAddItem} style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}>
              + Add Item
            </button>
          </div>

          {items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
              No items added yet.<br/>Click "+ Add Item" to assign inventory.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {items.map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', background: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                  <div style={{ flex: 2 }}>
                    <label style={labelStyle}>Product</label>
                    <select style={inputStyle} required value={item.productId} onChange={e => handleItemChange(index, 'productId', e.target.value)}>
                      <option value="" disabled>Select Product</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>Qty</label>
                    <input type="number" min="1" style={inputStyle} required value={item.quantity} onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)} />
                  </div>
                  <button type="button" onClick={() => handleRemoveItem(index)} style={{ padding: '10px', background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 'auto', paddingTop: '24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '12px' }}>
            <button type="button" onClick={() => router.back()} style={{ padding: '12px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              Cancel
            </button>
            <button type="submit" disabled={loading} style={{ padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, flex: 1 }}>
              {loading ? 'Processing...' : 'Create Delivery'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' };
