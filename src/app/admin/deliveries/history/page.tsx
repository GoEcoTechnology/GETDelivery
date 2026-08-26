'use client';
import { useEffect, useState, useCallback } from 'react';
import styles from '../../../admin/admin.module.css';
import { History, Search, Truck, CheckCircle2, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DeliveriesHistoryPage() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [page, setPage] = useState(1);
  const [limit] = useState(15);
  const [totalCount, setTotalCount] = useState(0);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      // In a real app, you'd add ?status=DELIVERED,CANCELLED filters to the API
      // For this demo, we'll fetch all and filter client side, or just show all
      const res = await fetch(`/api/deliveries?page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (res.ok) {
        const json = await res.json();
        // Filtering for history view (only completed or cancelled)
        const historyOnly = (json.data || []).filter((d: any) => ['DELIVERED', 'CANCELLED'].includes(d.status));
        setDeliveries(historyOnly);
        setTotalCount(historyOnly.length); // Approximation for client side filtering
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, [page, limit]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  return (
    <div>
      <div className={styles.header}>
        <div>
          <h1>Delivery History</h1>
          <p>Archives of completed and cancelled deliveries</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.href = '/admin/deliveries'}
            className={styles.btnSecondary}
          >
            Back to Active Deliveries
          </button>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(226, 232, 240, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontWeight: 600 }}>
            <History size={18} />
            <span>Delivery Archives</span>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Order Details</th>
              <th>Locations</th>
              <th>Status</th>
              <th>Completion Date</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px' }}>Loading History...</td></tr>
            ) : deliveries.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                  <History size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                  <p>No historical deliveries found.</p>
                </td>
              </tr>
            ) : (
              deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#1e293b' }}>{delivery.customerName}</div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{delivery.customerContact}</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Order #{delivery.id}</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '6px' }} />
                        <div style={{ color: '#475569', fontSize: '13px', maxWidth: '250px' }}>{delivery.pickupAddress}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '6px' }} />
                        <div style={{ color: '#475569', fontSize: '13px', maxWidth: '250px' }}>{delivery.dropoffAddress}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {delivery.status === 'DELIVERED' ? (
                       <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#dcfce7', color: '#16a34a', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                        <CheckCircle2 size={14} /> DELIVERED
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                        <XCircle size={14} /> CANCELLED
                      </span>
                    )}
                  </td>
                  <td style={{ color: '#475569', fontSize: '13px', fontWeight: 500 }}>
                    {/* Assuming updated_at represents completion time for simplicity */}
                    {new Date(delivery.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination Placeholder */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <button 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
