'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../../../admin/admin.module.css';
import { History, ChevronLeft, ChevronRight, ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function InventoryHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/history?page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        setHistory(json.data || []);
        setTotalCount(json.totalCount || 0);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Inventory Ledger</h1>
          <p>Complete transaction history of all stock movements</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => window.location.href = '/admin/inventory'} className={styles.btnSecondary}>
            Back to Inventory
          </button>
        </div>
      </div>

      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600 }}>
            <History size={18} />
            <span>Transaction Log</span>
          </div>
          <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
            Total: {totalCount} records
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date & Time</th>
              <th>Product</th>
              <th>Type</th>
              <th>Quantity</th>
              <th>Balance Before</th>
              <th>Balance After</th>
              <th>Reference / Actor</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td></tr>
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  No inventory transactions found.
                </td>
              </tr>
            ) : (
              history.map((tx) => (
                <tr key={tx.id}>
                  <td style={{ color: '#475569', fontSize: '13px' }}>
                    {new Date(tx.createdAt).toLocaleString()}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{tx.productName || 'Unknown Product'}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{tx.sku}</div>
                  </td>
                  <td>
                    {tx.transactionType === 'IN' ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 700, fontSize: '13px' }}>
                        <ArrowDownRight size={16} /> STOCK IN
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontWeight: 700, fontSize: '13px' }}>
                        <ArrowUpRight size={16} /> STOCK OUT
                      </span>
                    )}
                  </td>
                  <td style={{ fontWeight: 700, fontSize: '15px', color: tx.transactionType === 'IN' ? '#16a34a' : '#ef4444' }}>
                    {tx.transactionType === 'IN' ? '+' : '-'}{tx.quantity}
                  </td>
                  <td style={{ color: '#64748b' }}>{tx.previousStock}</td>
                  <td style={{ fontWeight: 600 }}>{tx.newStock}</td>
                  <td style={{ fontSize: '13px', color: '#475569' }}>
                    <div>{tx.reference || '-'}</div>
                    {tx.performedByName && <div style={{ color: '#94a3b8', fontSize: '11px' }}>by {tx.performedByName}</div>}
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
    </div>
  );
}
