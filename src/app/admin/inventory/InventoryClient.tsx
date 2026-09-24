'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../admin.module.css';
import {
  Search, Edit2, Trash2, PackagePlus, ArrowDownToLine, ChevronLeft, ChevronRight,
  X, History, ArrowUpRight, Download, ChevronDown, ChevronRight as ChevronRightIcon,
  Plus, Tag, Layers, Package
} from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';

/* ─── helpers ─── */
const fmt = (v: any) => {
  if (v == null) return '—';
  const num = Number(v);
  return new Intl.NumberFormat('en-PH', { 
    style: 'currency', 
    currency: 'PHP',
    minimumFractionDigits: Number.isInteger(num) ? 0 : 2
  }).format(num);
};

const StockBadge = ({ stock, threshold }: { stock: number | null; threshold: number | null }) => {
  if (stock == null) return <span style={{ color: '#94a3b8' }}>—</span>;
  const low = threshold ?? 0;
  const color = stock <= low ? '#dc2626' : '#16a34a';
  return <span style={{ color, fontWeight: 700 }}>{stock}</span>;
};

/* ─── Variant row (sub-row) ─── */
function VariantRow({ variant, productName }: { variant: any; productName: string }) {
  const [showUnits, setShowUnits] = useState(false);
  const hasUnits = variant.sellingUnits && variant.sellingUnits.length > 0;

  return (
    <div style={{ borderLeft: '2px solid #e2e8f0', marginLeft: '9px', paddingLeft: '20px', paddingBottom: '16px', paddingTop: '16px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => setShowUnits(!showUnits)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>{variant.name}</span>
            {variant.status !== 'ACTIVE' && (
              <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Inactive</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
            Stock: <StockBadge stock={variant.stock} threshold={variant.lowStockThreshold} /> {variant.unit ? variant.unit : ''}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a', width: '100px', textAlign: 'right' }}>{variant.price != null ? fmt(variant.price) : '—'}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '70px', justifyContent: 'flex-end' }}>
            <ActionMenu actions={[
              { label: 'Add Selling Unit', icon: <Plus size={14} />, onClick: () => window.dispatchEvent(new CustomEvent('add-selling-unit', { detail: { variant, productName } })), color: '#8b5cf6' },
              { label: 'Edit Variant', icon: <Edit2 size={14} />, onClick: () => window.dispatchEvent(new CustomEvent('edit-variant', { detail: { variant, productName } })), color: '#3b82f6' },
            ]} />
            <button onClick={() => setShowUnits(!showUnits)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex', width: 26, height: 26, justifyContent: 'center', alignItems: 'center' }}>
              {showUnits ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>
      </div>
      
      {showUnits && (
        <div style={{ marginTop: '16px' }}>
          {hasUnits && variant.sellingUnits.map((su: any) => (
            <div key={su.id} style={{ borderLeft: '2px solid #eab308', marginLeft: '8px', paddingLeft: '16px', paddingBottom: '12px', marginBottom: '12px' }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: '#334155' }}>{su.unitName}</span>
                    {su.status !== 'ACTIVE' && (
                      <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>Inactive</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                    <span style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', width: '100px', textAlign: 'right' }}>{fmt(su.price)}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '70px', justifyContent: 'flex-end' }}>
                      <ActionMenu actions={[
                        { label: 'Edit Selling Unit', icon: <Edit2 size={14} />, onClick: () => window.dispatchEvent(new CustomEvent('edit-selling-unit', { detail: { unit: su, variant, productName } })), color: '#3b82f6' },
                        { label: 'Delete Selling Unit', icon: <Trash2 size={14} />, onClick: () => window.dispatchEvent(new CustomEvent('delete-selling-unit', { detail: { unit: su, variant } })), color: '#ef4444' },
                      ]} />
                      <div style={{ width: 26 }} />
                    </div>
                  </div>
               </div>
               <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                 {su.description || `1 ${su.unitName} = ${Number(su.equivalentQty)} ${variant.unit || 'pcs'}`}
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Product row ─── */
function ProductRow({
  product,
  onEdit,
  onDelete,
}: {
  product: any;
  onEdit: (p: any) => void;
  onDelete: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasVariants = product.variants && product.variants.length > 0;

  // summary: total stock across all variants
  const totalStock = hasVariants
    ? product.variants.reduce((s: number, v: any) => s + (Number(v.stock) || 0), 0)
    : 0;

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: expanded ? '#f8fafc' : '#fff' }}>
        <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => hasVariants && setExpanded(!expanded)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 6, background: '#ecfdf5', color: '#10b981' }}>
              <Layers size={14} />
            </div>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#0f172a' }}>{product.name}</span>
            {product.status !== 'ACTIVE' && (
              <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>Inactive</span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', paddingLeft: '36px' }}>
            {product.variants?.length || 0} Variants • Total Inventory: {totalStock.toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ActionMenu actions={[
            {
              label: 'Edit Product',
              icon: <Edit2 size={14} />,
              onClick: () => onEdit(product),
              color: '#3b82f6'
            },
            {
              label: 'Add Variant',
              icon: <Plus size={14} />,
              onClick: () => window.dispatchEvent(new CustomEvent('add-variant', { detail: { product } })),
              color: '#8b5cf6'
            },
            {
              label: 'Delete Product',
              icon: <Trash2 size={14} />,
              onClick: () => onDelete(product.id),
              color: '#ef4444'
            }
          ]} />
          {hasVariants && (
            <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
        </div>
      </div>

      {expanded && hasVariants && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0 20px', background: '#fff' }}>
          {product.variants.map((v: any, idx: number) => (
             <div key={v.id} style={{ padding: '0' }}>
               <VariantRow variant={v} productName={product.name} />
             </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ─── */
export default function InventoryClient() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState('');

  const [editModal, setEditModal] = useState<any>(null);
  const [variantModal, setVariantModal] = useState<any>(null);
  const [unitModal, setUnitModal] = useState<any>(null);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(
        `/api/products?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
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
    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [page, search, fetchProducts]);

  useEffect(() => {
    const openVariant = (event: Event) => setVariantModal((event as CustomEvent).detail);
    const openUnit = (event: Event) => setUnitModal((event as CustomEvent).detail);
    const addVariant = (event: Event) => {
      const { product } = (event as CustomEvent).detail;
      setVariantModal({ productName: product.name, productId: product.id, isNew: true, variant: { name: '', quantity: '', price: '', weightPerPieceKg: '', quota: '', stock: '', status: 'ACTIVE' } });
    };
    const addUnit = (event: Event) => {
      const { variant, productName } = (event as CustomEvent).detail;
      setUnitModal({ productName, variant, isNew: true, unit: { productId: variant.productId, unitName: '', equivalentQty: '', description: '', price: '', status: 'ACTIVE' } });
    };
    const deleteVariant = async (event: Event) => {
      const { variant } = (event as CustomEvent).detail;
      if (!confirm(`Delete variant "${variant.name}"?`)) return;
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/products/${variant.productId}/variants/${variant.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchProducts(); else alert('Failed to delete variant');
    };
    const deleteUnit = async (event: Event) => {
      const { unit, variant } = (event as CustomEvent).detail;
      if (!confirm(`Delete selling unit "${unit.unitName}"?`)) return;
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/products/${unit.productId}/variants/${variant.id}/selling-units/${unit.id}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchProducts(); else alert('Failed to delete selling unit');
    };

    window.addEventListener('edit-variant', openVariant);
    window.addEventListener('edit-selling-unit', openUnit);
    window.addEventListener('add-variant', addVariant);
    window.addEventListener('add-selling-unit', addUnit);
    window.addEventListener('delete-variant', deleteVariant);
    window.addEventListener('delete-selling-unit', deleteUnit);
    return () => {
      window.removeEventListener('edit-variant', openVariant);
      window.removeEventListener('edit-selling-unit', openUnit);
      window.removeEventListener('add-variant', addVariant);
      window.removeEventListener('add-selling-unit', addUnit);
      window.removeEventListener('delete-variant', deleteVariant);
      window.removeEventListener('delete-selling-unit', deleteUnit);
    };
  }, [fetchProducts]);

  const saveVariant = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!variantModal) return;
    const token = localStorage.getItem('token') || '';
    const productId = variantModal.productId || variantModal.variant.productId;
    const res = await fetch(variantModal.isNew
      ? `/api/products/${productId}/variants`
      : `/api/products/${productId}/variants/${variantModal.variant.id}`, {
      method: variantModal.isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(variantModal.variant),
    });
    if (!res.ok) return alert('Failed to update variant');
    setVariantModal(null);
    fetchProducts();
  };

  const saveUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!unitModal) return;
    const token = localStorage.getItem('token') || '';
    const { unit, variant } = unitModal;
    const baseUrl = `/api/products/${unit.productId}/variants/${variant.id}/selling-units`;
    const res = await fetch(unitModal.isNew ? baseUrl : `${baseUrl}/${unit.id}`, {
      method: unitModal.isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(unit),
    });
    if (!res.ok) return alert('Failed to update selling unit');
    setUnitModal(null);
    fetchProducts();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/products/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
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
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/products/${editModal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  const exportCurrentStock = async () => {
    try {
      setExporting(true);
      setShowExportMenu(false);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/products?page=1&limit=100000`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed to fetch stock for export');
      const json = await res.json();
      const data = json.data || [];

      const rows = ['Product Name,Variant,Category,Price,Stock,Unit,Status'];
      for (const p of data) {
        for (const v of (p.variants || [])) {
          rows.push([
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${(v.name || '').replace(/"/g, '""')}"`,
            `"${(p.category || '').replace(/"/g, '""')}"`,
            v.price || 0,
            v.stock || 0,
            `"${(v.unit || '').replace(/"/g, '""')}"`,
            `"${p.status || ''}"`,
          ].join(','));
        }
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Current_Stock_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export current stock.');
    } finally {
      setExporting(false);
    }
  };

  const exportStockHistory = async () => {
    try {
      setExporting(true);
      setShowExportMenu(false);
      const token = localStorage.getItem('token') || '';
      const res = await fetch(`/api/inventory/history?page=1&limit=100000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const data = json.data || [];

      const rows = ['Date,Time,Product Name,Type,Qty Change,Previous,New,Reference,Performed By'];
      for (const item of data) {
        const d = new Date(item.createdAt);
        rows.push([
          `"${d.toLocaleDateString()}"`,
          `"${d.toLocaleTimeString()}"`,
          `"${(item.productName || '').replace(/"/g, '""')}"`,
          `"${item.transactionType === 'IN' ? 'STOCK IN' : 'STOCK OUT'}"`,
          item.transactionType === 'IN' ? item.quantity : -item.quantity,
          item.previousStock,
          item.newStock,
          `"${(item.reference || '').replace(/"/g, '""')}"`,
          `"${(item.performedByName || '').replace(/"/g, '""')}"`
        ].join(','));
      }

      const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Stock_History_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert('Failed to export stock history.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className={styles.inputField}
              style={{ paddingLeft: '36px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {/* Export dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowExportMenu(!showExportMenu); setShowActionsMenu(false); }}
                className={`${styles.btnSecondary} ${styles.toolbarBtn}`}
                style={{ color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#e0e7ff', whiteSpace: 'nowrap' }}
                disabled={exporting}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                {exporting ? 'Exporting...' : 'Export'}
                <ChevronDown size={12} style={{ marginLeft: '4px' }} />
              </button>
              {showExportMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden', minWidth: '160px' }}>
                  <button onClick={exportCurrentStock} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#334155', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    Current Stock
                  </button>
                  <button onClick={exportStockHistory} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '10px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#334155' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    Stock History
                  </button>
                </div>
              )}
            </div>

            {/* Actions dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => { setShowActionsMenu(!showActionsMenu); setShowExportMenu(false); }}
                className={`${styles.btnPrimary} ${styles.toolbarBtn}`}
                style={{ whiteSpace: 'nowrap' }}
              >
                Actions <ChevronDown size={12} style={{ marginLeft: '4px' }} />
              </button>
              {showActionsMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.12)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden', minWidth: '160px' }}>
                  <button onClick={() => { window.location.href = '/admin/inventory/history'; setShowActionsMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#475569', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <History size={14} color="#64748b" /> History
                  </button>
                  <button onClick={() => { window.location.href = '/admin/inventory/stock-in'; setShowActionsMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#15803d', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f0fdf4'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <ArrowDownToLine size={14} color="#15803d" /> Stock In
                  </button>
                  <button onClick={() => { window.location.href = '/admin/inventory/stock-out'; setShowActionsMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#b91c1c', borderBottom: '1px solid #f1f5f9' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <ArrowUpRight size={14} color="#b91c1c" /> Stock Out
                  </button>
                  <button onClick={() => { window.location.href = '/admin/inventory/add'; setShowActionsMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '11px 16px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: '#4f46e5', fontWeight: 700 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#eef2ff'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <PackagePlus size={14} color="#4f46e5" /> Add Product
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#f8fafc' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
              Loading…
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: '0', border: 'none' }}>
              <EmptyState
                icon={Package}
                title="No Products Found"
                description="No products found in your inventory. Add your first product."
                actionButton={<button onClick={() => window.location.href = '/admin/inventory/add'} className={styles.btnPrimary}>+ Add Product</button>}
              />
            </div>
          ) : (
            products.map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                onEdit={setEditModal}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>
            Page {page} of {totalPages || 1} &nbsp;·&nbsp; {totalCount} products
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page >= totalPages ? 0.5 : 1 }}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {variantModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <form onSubmit={saveVariant} style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>{variantModal.isNew ? 'Add Variant' : 'Edit Variant'}</h2>
              <button type="button" onClick={() => setVariantModal(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <label className={styles.label}>Product Name</label>
            <input className={styles.inputField} value={variantModal.productName} readOnly style={{ marginBottom: 14, background: '#f8fafc' }} />
            <label className={styles.label}>Variant Name *</label>
            <input required className={styles.inputField} value={variantModal.variant.name || ''} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, name: e.target.value } })} style={{ marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              <div><label className={styles.label}>Qty</label><input className={styles.inputField} type="number" value={variantModal.variant.quantity || 1} readOnly style={{ background: '#f8fafc' }} /></div>
              <div><label className={styles.label}>Price *</label><input required className={styles.inputField} type="number" min="0" step="0.01" value={variantModal.variant.price ?? ''} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, price: e.target.value } })} /></div>
              <div><label className={styles.label}>Weight (kg) *</label><input required className={styles.inputField} type="number" min="0" step="0.001" value={variantModal.variant.weightPerPieceKg ?? ''} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, weightPerPieceKg: e.target.value } })} /></div>
              <div><label className={styles.label}>Quota *</label><input required className={styles.inputField} type="number" min="0" value={variantModal.variant.quota ?? ''} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, quota: e.target.value } })} /></div>
              <div><label className={styles.label}>Current Stock *</label><input required className={styles.inputField} type="number" min="0" value={variantModal.variant.stock ?? ''} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, stock: e.target.value } })} /></div>
            </div>
            <label className={styles.label} style={{ marginTop: 14 }}>Status</label>
            <select className={styles.inputField} value={variantModal.variant.status || 'ACTIVE'} onChange={e => setVariantModal({ ...variantModal, variant: { ...variantModal.variant, status: e.target.value } })}>
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" onClick={() => setVariantModal(null)} className={styles.btnSecondary}>Cancel</button>
              <button type="submit" className={styles.btnPrimary}>Save Variant</button>
            </div>
          </form>
        </div>
      )}

      {unitModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 24 }}>
          <form onSubmit={saveUnit} style={{ background: 'white', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 20px 25px rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{unitModal.isNew ? 'Add Selling Unit' : 'Edit Selling Unit'}</h2>
              <button type="button" onClick={() => setUnitModal(null)} style={{ background: 'none', border: 0, cursor: 'pointer', color: '#94a3b8' }}><X size={20} /></button>
            </div>
            <label className={styles.label}>Product Name</label>
            <input className={styles.inputField} value={unitModal.productName} readOnly style={{ marginBottom: 14, background: '#f8fafc' }} />
            <label className={styles.label}>Variant Name</label>
            <input className={styles.inputField} value={unitModal.variant.name || ''} readOnly style={{ marginBottom: 14, background: '#f8fafc' }} />
            <label className={styles.label}>Selling Unit Name *</label>
            <input required className={styles.inputField} value={unitModal.unit.unitName || ''} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, unitName: e.target.value } })} style={{ marginBottom: 14 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div><label className={styles.label}>Qty Per Unit *</label><input required className={styles.inputField} type="number" min="1" step="0.01" value={unitModal.unit.equivalentQty ?? ''} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, equivalentQty: e.target.value } })} /></div>
              <div><label className={styles.label}>Selling Price *</label><input required className={styles.inputField} type="number" min="0" step="0.01" value={unitModal.unit.price ?? ''} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, price: e.target.value } })} /></div>
              <div><label className={styles.label}>Weight (kg)</label><input className={styles.inputField} type="number" min="0" step="0.001" value={unitModal.unit.weight ?? ''} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, weight: e.target.value } })} /></div>
            </div>
            <label className={styles.label} style={{ marginTop: 14 }}>Description *</label>
            <textarea required className={styles.inputField} rows={3} value={unitModal.unit.description || ''} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, description: e.target.value } })} placeholder="1 Case = 24 bottles" />
            <label className={styles.label} style={{ marginTop: 14 }}>Calculated Stock</label>
            <input className={styles.inputField} readOnly value={`${Math.floor((Number(unitModal.variant.stock) || 0) / (Number(unitModal.unit.equivalentQty) || 1))} available`} style={{ background: '#f8fafc', marginBottom: 14 }} />
            <label className={styles.label}>Status</label>
            <select className={styles.inputField} value={unitModal.unit.status || 'ACTIVE'} onChange={e => setUnitModal({ ...unitModal, unit: { ...unitModal.unit, status: e.target.value } })}>
              <option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
              <button type="button" onClick={() => setUnitModal(null)} className={styles.btnSecondary}>Cancel</button>
              <button type="submit" className={styles.btnPrimary}>Save Selling Unit</button>
            </div>
          </form>
        </div>
      )}

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
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Category</label>
                <input className={styles.inputField} type="text" value={editModal.category || ''} onChange={e => setEditModal({ ...editModal, category: e.target.value })} />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label className={styles.label}>Status</label>
                <select className={styles.inputField} value={editModal.status} onChange={e => setEditModal({ ...editModal, status: e.target.value })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setEditModal(null)} style={{ padding: '12px 20px', background: 'none', border: '1px solid #cbd5e1', borderRadius: '10px', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" className={styles.btnPrimary}>Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
