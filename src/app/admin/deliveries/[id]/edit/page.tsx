'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import styles from '../../../admin.module.css';

export default function EditDeliveryPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
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
    Promise.all([
      fetch('/api/products?limit=100').then(res => res.json()),
      fetch('/api/customers?limit=100').then(res => res.json()),
      fetch(`/api/deliveries/${id}`).then(res => res.json())
    ]).then(([productsData, customersData, orderData]) => {
      setProducts(productsData.data || []);
      setCustomers(customersData.data || []);
      
      const order = orderData.data;
      if (order) {
        setFormData({
          customerId: order.customerId?.toString() || '',
          customerName: order.customerName || '',
          customerContact: order.customerContact || '',
          pickupAddress: order.pickupAddress || '',
          dropoffAddress: order.dropoffAddress || '',
          deliveryDate: order.deliveryDate ? new Date(order.deliveryDate).toISOString().slice(0, 16) : '',
          instructions: order.instructions || ''
        });
        
        if (order.items && order.items.length > 0) {
          setItems(order.items.map((i: any) => ({
            productId: i.productId.toString(),
            quantity: i.quantity,
            unit: i.unit || 'pcs'
          })));
        } else {
          setItems([]);
        }
      }
      setInitialLoading(false);
    }).catch(err => {
      alert('Error fetching data');
      setInitialLoading(false);
    });
  }, [id]);

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
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      
      if (res.ok) {
        router.push('/admin/deliveries');
      } else {
        alert(data.error || 'Failed to update delivery items');
      }
    } catch (err) {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading order...</div>;
  }

  return (
    <div>
      <div className={styles.header}>
        <h1>Edit Delivery Items</h1>
        <p>Update inventory items for this accumulating draft order.</p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        
        {/* Left Column: Delivery Details (Read-only) */}
        <div className={styles.card} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3>Delivery Details (Read-only)</h3>
          
          <div>
            <label style={labelStyle}>Customer Name</label>
            <input style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} disabled value={formData.customerName} />
          </div>

          <div>
            <label style={labelStyle}>Contact Number</label>
            <input style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} disabled value={formData.customerContact} />
          </div>

          <div>
            <label style={labelStyle}>Pickup Address</label>
            <input style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} disabled value={formData.pickupAddress} />
          </div>

          <div>
            <label style={labelStyle}>Drop-off Address</label>
            <input style={{...inputStyle, background: '#f8fafc', color: '#64748b'}} disabled value={formData.dropoffAddress} />
          </div>

          <div style={{ marginTop: 'auto', paddingTop: '24px', color: '#94a3b8', fontSize: '13px' }}>
            Note: Delivery details cannot be edited here. 
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
              {loading ? 'Saving...' : 'Save Items'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const labelStyle = { display: 'block', marginBottom: '4px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase' as const };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', background: 'white' };
