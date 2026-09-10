'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import { Search, Edit2, Trash2, PackagePlus, ArrowDownToLine, ChevronLeft, ChevronRight, X, History, ArrowUpRight, BarChart3 } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';

export default function InventoryClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [limit] = useState(7);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');

  // Modals
  const [editModal, setEditModal] = useState<any>(null);

  // Add Product State



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
    const timer = setTimeout(() => {
      fetchProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [page, search, fetchProducts]);

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



  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', flexWrap: 'nowrap', gap: '16px' }}>
          <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '200px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search products "
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap', overflowX: 'auto', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>

            <button 
              onClick={() => window.location.href = '/admin/inventory/history'} 
              className={`${styles.btnSecondary} ${styles.toolbarBtn}`}
              style={{ color: '#475569', borderColor: '#cbd5e1', backgroundColor: '#f8fafc' }}
            >
              <History size={14} style={{ marginRight: '6px' }} /> History
            </button>

            <button 
              onClick={() => window.location.href = '/admin/inventory/stock-in'} 
              className={`${styles.btnSecondary} ${styles.toolbarBtn}`}
              style={{ color: '#15803d', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' }}
            >
              <ArrowDownToLine size={14} style={{ marginRight: '6px' }} /> Stock In
            </button>
            <button 
              onClick={() => window.location.href = '/admin/inventory/stock-out'} 
              className={`${styles.btnSecondary} ${styles.toolbarBtn}`}
              style={{ color: '#b91c1c', borderColor: '#fecaca', backgroundColor: '#fef2f2' }}
            >
              <ArrowUpRight size={14} style={{ marginRight: '6px' }} /> Stock Out
            </button>

            <button onClick={() => window.location.href = '/admin/inventory/add'} className={`${styles.btnPrimary} ${styles.toolbarBtn}`}>
              <PackagePlus size={14} style={{ marginRight: '6px' }} /> Add
            </button>
          </div>
        </div>

        <div className="table-responsive-wrapper">

          <table className={styles.table}>
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody className={!loading ? styles.fadeIn : ''}>
              {loading ? null : products.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    No products found.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} onClick={() => setEditModal(product)} style={{ cursor: 'pointer' }}>
                    <td style={{ fontWeight: 600 }}>{product.name}</td>
                    <td>
                      <span style={{ padding: '4px 8px', backgroundColor: '#f1f5f9', color: '#475569', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                        {product.category || 'General'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{product.price ? new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(product.price) : '-'}</td>
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
                      <ActionMenu actions={[
                        { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => setEditModal(product), color: '#3b82f6' },
                        { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(product.id), color: '#ef4444' }
                      ]} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

        </div>

        {/* Pagination Controls */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages || 1}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page >= totalPages ? 0.5 : 1 }}
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
                <input required className={styles.inputField} type="text" value={editModal.name} onChange={e => setEditModal({ ...editModal, name: e.target.value })} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label className={styles.label}>SKU</label>
                  <input className={styles.inputField} type="text" value={editModal.sku || ''} onChange={e => setEditModal({ ...editModal, sku: e.target.value })} />
                </div>
                <div>
                  <label className={styles.label}>Unit (e.g. kg, pcs)</label>
                  <input required className={styles.inputField} type="text" value={editModal.unit} onChange={e => setEditModal({ ...editModal, unit: e.target.value })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Low Stock Threshold</label>
                  <input required className={styles.inputField} type="number" min="0" value={editModal.lowStockThreshold || 0} onChange={e => setEditModal({ ...editModal, lowStockThreshold: e.target.value === '' ? 0 : parseInt(e.target.value) })} />
                </div>
                <div>
                  <label className={styles.label}>Unit Price (USD)</label>
                  <input className={styles.inputField} type="number" step="0.01" min="0" value={editModal.price || ''} onChange={e => setEditModal({ ...editModal, price: e.target.value === '' ? null : parseFloat(e.target.value) })} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '24px' }}>
                <div>
                  <label className={styles.label}>Status</label>
                  <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })}>
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




    </div>
  );
}
