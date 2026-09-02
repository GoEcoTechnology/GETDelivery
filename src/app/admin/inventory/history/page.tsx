'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../../../admin/admin.module.css';
import { History, ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Package } from 'lucide-react';

export default function InventoryHistoryPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit] = useState(7);
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

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  const skeletonRows = Array.from({ length: 8 });

  return (
    <div>
      <div className={styles.card} style={{ padding: '0', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={18} color="white" />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>Transaction Log</div>
              <div style={{ fontSize: '12px', color: '#94a3b8' }}>All stock movement records</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>
              {totalCount} total records
            </div>
            <button
              onClick={() => window.location.href = '/admin/inventory'}
              className={styles.btnSecondary}
            >
              ← Back to Inventory
            </button>
          </div>
        </div>

        {/* Table */}
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date &amp; Time</th>
              <th>Product</th>
              <th>Movement</th>
              <th style={{ textAlign: 'center' }}>Qty Change</th>
              <th style={{ textAlign: 'center' }}>Before</th>
              <th style={{ textAlign: 'center' }}>After</th>
              <th>Reference</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              skeletonRows.map((_, i) => (
                <tr key={i}>
                  {[120, 160, 90, 60, 60, 60, 130].map((w, j) => (
                    <td key={j} style={{ padding: '18px 24px' }}>
                      <div style={{
                        height: '14px', borderRadius: '6px', width: `${w}px`,
                        background: 'linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)',
                        backgroundSize: '200% 100%',
                        animation: 'shimmer 1.5s infinite',
                        margin: j === 3 || j === 4 || j === 5 ? '0 auto' : 0
                      }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : history.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '60px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', color: '#94a3b8' }}>
                    <Package size={40} strokeWidth={1.5} />
                    <div style={{ fontWeight: 600, color: '#64748b' }}>No transactions yet</div>
                    <div style={{ fontSize: '13px' }}>Stock movements will appear here</div>
                  </div>
                </td>
              </tr>
            ) : (
              history.map((tx) => {
                const isIn = tx.transactionType === 'IN';
                return (
                  <tr key={tx.id}>
                    {/* Date */}
                    <td>
                      <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600 }}>
                        {new Date(tx.createdAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        {new Date(tx.createdAt).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </td>

                    {/* Product */}
                    <td>
                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>{tx.productName || 'Unknown'}</div>
                      {tx.sku && <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>SKU: {tx.sku}</div>}
                    </td>

                    {/* Movement badge */}
                    <td>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '5px',
                        padding: '5px 11px', borderRadius: '20px',
                        background: isIn ? '#dcfce7' : '#fef2f2',
                        color: isIn ? '#15803d' : '#dc2626',
                        fontSize: '12px', fontWeight: 700
                      }}>
                        {isIn ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                        {isIn ? 'STOCK IN' : 'STOCK OUT'}
                      </div>
                    </td>

                    {/* Quantity change */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        fontWeight: 800, fontSize: '16px',
                        color: isIn ? '#16a34a' : '#ef4444'
                      }}>
                        {isIn ? '+' : '−'}{tx.quantity}
                      </div>
                    </td>

                    {/* Before */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{tx.previousStock}</div>
                    </td>

                    {/* After */}
                    <td style={{ textAlign: 'center' }}>
                      <div style={{
                        display: 'inline-block',
                        fontWeight: 700, fontSize: '14px',
                        color: tx.newStock <= 5 ? '#ef4444' : '#1e293b',
                        background: tx.newStock <= 5 ? '#fef2f2' : '#f8fafc',
                        padding: '3px 10px', borderRadius: '6px'
                      }}>
                        {tx.newStock}
                      </div>
                    </td>

                    {/* Reference */}
                    <td>
                      <div style={{ fontSize: '13px', color: '#475569' }}>{tx.reference || '—'}</div>
                      {tx.performedByName && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>by {tx.performedByName}</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination — consistent style */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226,232,240,0.5)', backgroundColor: 'rgba(248,250,252,0.5)' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600, opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>

        <style>{`
          @keyframes shimmer {
            0% { background-position: 200% 0; }
            100% { background-position: -200% 0; }
          }
        `}</style>
      </div>
    </div>
  );
}
