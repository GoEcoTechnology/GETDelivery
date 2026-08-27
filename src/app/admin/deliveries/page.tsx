'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Truck, Search, XCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Edit, CheckSquare } from 'lucide-react';
import { DispatchModal } from './DispatchModal';

export default function DeliveriesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);

  const { data, isLoading: loading } = useQuery({
    queryKey: ['deliveries', page, limit],
    queryFn: async () => {
      const res = await fetch(`/api/deliveries?page=${page}&limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      return res.json();
    }
  });

  const deliveries = data?.data || [];
  const totalCount = data?.totalCount || 0;

  const handleDispatch = (id: number) => {
    setSelectedDeliveryId(id);
    setIsDispatchModalOpen(true);
  };

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deliveries/${id}/cancel`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel delivery');
      return data;
    },
    onSuccess: () => {
      alert('Delivery cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    }
  });

  const readyMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deliveries/${id}/ready`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark as ready');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
    },
    onError: (error: any) => {
      alert(`Error: ${error.message}`);
    }
  });

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this delivery order? This will cancel any pending driver invitations.')) return;
    cancelMutation.mutate(id);
  };

  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div>
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Active Deliveries</h1>
          <p>Track, dispatch, and manage your delivery orders</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.location.href = '/admin/deliveries/history'}
            className={styles.btnSecondary}
          >
            <HistoryIcon /> View History
          </button>
          <button 
            onClick={() => window.location.href = '/admin/deliveries/create'}
            className={styles.btnPrimary}
          >
            + Create Delivery
          </button>
        </div>
      </div>

      <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order Details</th>
                <th>Locations</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    <Truck size={48} style={{ opacity: 0.3, marginBottom: '16px' }} />
                    <p>No active deliveries found. Create your first delivery.</p>
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery: any) => (
                  <tr key={delivery.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#1e293b' }}>{delivery.customerName}</div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>{delivery.customerContact}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Order #{delivery.id}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '6px', flexShrink: 0 }} />
                          <div style={{ color: '#475569', fontSize: '13px', maxWidth: '250px' }}>{delivery.pickupAddress}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '6px', flexShrink: 0 }} />
                          <div style={{ color: '#475569', fontSize: '13px', maxWidth: '250px' }}>{delivery.dropoffAddress}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={delivery.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {delivery.status === 'DRAFT' && (
                          <>
                            <button 
                              onClick={() => window.location.href = `/admin/deliveries/${delivery.id}/edit`}
                              style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <Edit size={14} /> Edit Items
                            </button>
                            <button 
                              onClick={() => readyMutation.mutate(delivery.id)}
                              style={{ padding: '6px 12px', backgroundColor: '#eab308', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <CheckSquare size={14} /> Mark Ready
                            </button>
                          </>
                        )}
                        
                        {delivery.status === 'READY_FOR_DISPATCH' && (
                          <button 
                            onClick={() => handleDispatch(delivery.id)}
                            style={{ padding: '6px 12px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                          >
                            <Truck size={14} /> Dispatch
                          </button>
                        )}

                        {delivery.status === 'WAITING_APPROVAL' && (
                          <>
                            <button 
                              onClick={async () => {
                                if(!confirm('Approve this partner?')) return;
                                const res = await fetch(`/api/deliveries/${delivery.id}/approve-partner`, { method: 'POST' });
                                if (res.ok) queryClient.invalidateQueries({ queryKey: ['deliveries'] });
                                else alert('Failed to approve');
                              }}
                              style={{ padding: '6px 12px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button 
                              onClick={async () => {
                                if(!confirm('Reject this partner?')) return;
                                const res = await fetch(`/api/deliveries/${delivery.id}/reject-partner`, { method: 'POST' });
                                if (res.ok) queryClient.invalidateQueries({ queryKey: ['deliveries'] });
                                else alert('Failed to reject');
                              }}
                              style={{ padding: '6px 12px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        
                        {!['DELIVERED', 'CANCELLED'].includes(delivery.status) && (
                          <button 
                            onClick={() => handleCancel(delivery.id)}
                            style={{ padding: '6px 8px', backgroundColor: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                            title="Cancel Delivery"
                          >
                            <XCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', backgroundColor: 'rgba(248, 250, 252, 0.5)' }}>
          <button 
            disabled={page === 1} 
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#475569' }}>Page {page}</span>
          <button 
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 600 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <DispatchModal 
        isOpen={isDispatchModalOpen} 
        onClose={() => { setIsDispatchModalOpen(false); setSelectedDeliveryId(null); }} 
        deliveryId={selectedDeliveryId} 
        onDispatchComplete={() => queryClient.invalidateQueries({ queryKey: ['deliveries'] })} 
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = '#475569';
  let bg = '#f1f5f9';
  let Icon = Clock;

  if (status === 'READY_FOR_DISPATCH') { color = '#d97706'; bg = '#fef3c7'; }
  else if (status === 'DRAFT') { color = '#64748b'; bg = '#f1f5f9'; Icon = Edit; }
  else if (status === 'WAITING_APPROVAL') { color = '#0284c7'; bg = '#e0f2fe'; Icon = Clock; }
  else if (status === 'DISPATCHED' || status === 'ASSIGNED') { color = '#2563eb'; bg = '#dbeafe'; Icon = Truck; }
  else if (status === 'IN_TRANSIT') { color = '#8b5cf6'; bg = '#ede9fe'; Icon = Truck; }
  else if (status === 'DELIVERED') { color = '#16a34a'; bg = '#dcfce7'; Icon = CheckCircle2; }
  else if (status === 'CANCELLED') { color = '#ef4444'; bg = '#fee2e2'; Icon = XCircle; }

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '6px 12px', backgroundColor: bg, color: color,
      borderRadius: '999px', fontSize: '12px', fontWeight: 700
    }}>
      <Icon size={14} />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function HistoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M12 7v5l4 2"/>
    </svg>
  );
}
