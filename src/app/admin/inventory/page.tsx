'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { Search, Edit2, Trash2, PackagePlus, ArrowDownToLine, ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function InventoryPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');
  
  // Modals
  const [editModal, setEditModal] = useState<any>(null);
  const [addModal, setAddModal] = useState(false);
  const [stockInModal, setStockInModal] = useState(false);

  // Add Product State
  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newUnit, setNewUnit] = useState('Pieces (pcs)');
  const [newThreshold, setNewThreshold] = useState<number | ''>(10);

  // Stock In State
  const [stockInProductId, setStockInProductId] = useState<number | ''>('');
  const [stockInQuantity, setStockInQuantity] = useState(0);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const json = await res.json();
        setProducts(json.data || []);
        setTotalCount(json.totalCount || 0);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    // Debounce search
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) fetchProducts();
      else alert('Failed to delete product');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    try {
      const res = await fetch(`/api/products/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editModal)
      });
      if (res.ok) {
        setEditModal(null);
        fetchProducts();
      } else {
        alert('Failed to update product');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          sku: newSku,
          category: newCategory,
          unit: newUnit,
          lowStockThreshold: newThreshold
        })
      });
      if (res.ok) {
        setAddModal(false);
        setNewName('');
        setNewSku('');
        setNewCategory('');
        setNewUnit('Pieces (pcs)');
        setNewThreshold(10);
        fetchProducts();
      } else {
        const err = await res.json();
        alert(`Failed to add product: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInProductId || stockInQuantity <= 0) {
      alert('Please select a valid product and quantity.');
      return;
    }
    try {
      const res = await fetch('/api/inventory/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: Number(stockInProductId),
          quantity: stockInQuantity,
          transactionType: 'IN',
          reference: 'Manual Stock In'
        })
      });
      if (res.ok) {
        setStockInModal(false);
        setStockInProductId('');
        setStockInQuantity(0);
        fetchProducts();
      } else {
        const err = await res.json();
        alert(`Failed to stock in: ${err.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Inventory Management</h1>
          <p>Track, update, and manage your products</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setStockInModal(true)} className={styles.btnSuccess}>
            <ArrowDownToLine size={16} /> Stock In
          </button>
          <button onClick={() => setAddModal(true)} className={styles.btnPrimary}>
            <PackagePlus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '300px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Search products by name or SKU..." 
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Total: {totalCount} items
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id}>
                  <td style={{ fontWeight: 600 }}>{product.name}</td>
                  <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '13px' }}>{product.sku || '-'}</td>
                  <td>
                    <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                      {product.category || 'General'}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: product.stock <= (product.lowStockThreshold || 0) ? '#dc2626' : '#16a34a', fontWeight: 700, fontSize: '15px' }}>
                      {product.stock} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>{product.unit}</span>
                    </span>
                  </td>
                  <td>
                    {product.status === 'ACTIVE' 
                      ? <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                      : <span className={`${styles.badge} ${styles.badgeError}`}>Inactive</span>
                    }
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button onClick={() => setEditModal(product)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: '8px' }}>
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleDelete(product.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', padding: '8px' }}>
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Controls */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages || 1}</span>
          <button 
            disabled={page >= totalPages} 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Edit Product</h2>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Product Name</label>
                <input required className={styles.inputField} type="text" value={editModal.name} onChange={e => setEditModal({...editModal, name: e.target.value})} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>SKU</label>
                  <input className={styles.inputField} type="text" value={editModal.sku || ''} onChange={e => setEditModal({...editModal, sku: e.target.value})} />
                </div>
                <div>
                  <label className={styles.label}>Unit (e.g. kg, pcs)</label>
                  <input required className={styles.inputField} type="text" value={editModal.unit} onChange={e => setEditModal({...editModal, unit: e.target.value})} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Low Stock Threshold</label>
                  <input required className={styles.inputField} type="number" min="0" value={editModal.lowStockThreshold || 0} onChange={e => setEditModal({...editModal, lowStockThreshold: e.target.value === '' ? 0 : parseInt(e.target.value)})} />
                </div>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({...editModal, status: e.target.value})}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditModal(null)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      {addModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Add New Product</h2>
              <button onClick={() => setAddModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleAddProduct}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Product Name *</label>
                <input required className={styles.inputField} type="text" placeholder="e.g. Solar Panel 550W" value={newName} onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>SKU (Optional)</label>
                  <input className={styles.inputField} type="text" placeholder="SP-550W" value={newSku} onChange={e => setNewSku(e.target.value)} />
                </div>
                <div>
                  <label className={styles.label}>Category</label>
                  <input className={styles.inputField} type="text" placeholder="Electronics" value={newCategory} onChange={e => setNewCategory(e.target.value)} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Unit of Measure</label>
                  <select className={styles.inputField} value={newUnit} onChange={e => setNewUnit(e.target.value)}>
                    <option value="Pieces (pcs)">Pieces (pcs)</option>
                    <option value="Kilograms (kg)">Kilograms (kg)</option>
                    <option value="Liters (L)">Liters (L)</option>
                    <option value="Boxes">Boxes</option>
                  </select>
                </div>
                <div>
                  <label className={styles.label}>Low Stock Alert Threshold</label>
                  <input required className={styles.inputField} type="number" min="0" value={newThreshold === '' ? '' : newThreshold} onChange={e => setNewThreshold(e.target.value === '' ? '' as any : parseInt(e.target.value))} />
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setAddModal(false)} style={{ padding: '12px 20px', background: 'white', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnPrimary} style={{ background: '#2563eb', color: 'white', border: 'none', padding: '12px 20px', borderRadius: '10px', fontWeight: 600, cursor: 'pointer' }}>Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock In Modal */}
      {stockInModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '32px', width: '100%', maxWidth: '400px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>Stock In</h2>
              <button onClick={() => setStockInModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            
            <form onSubmit={handleStockIn}>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Select Product</label>
                <select required className={styles.inputField} value={stockInProductId} onChange={e => setStockInProductId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">-- Choose a product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} {p.sku ? `(${p.sku})` : ''}</option>
                  ))}
                </select>
                <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>*Only showing products from current search/page.</p>
              </div>
              <div style={{ marginBottom: '24px' }}>
                <label className={styles.label}>Quantity to Add</label>
                <input required className={styles.inputField} type="number" min="1" value={stockInQuantity === 0 ? '' : stockInQuantity} onChange={e => setStockInQuantity(e.target.value === '' ? 0 : parseInt(e.target.value))} placeholder="e.g. 50" />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setStockInModal(false)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className={styles.btnSuccess}>Confirm Stock In</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
