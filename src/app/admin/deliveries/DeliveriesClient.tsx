'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Truck, XCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Edit, CheckSquare, Trash2, Plus, Mail, Phone } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';
import dynamic from 'next/dynamic';

const DispatchModal = dynamic(() => import('./DispatchModal').then(m => m.DispatchModal), {
  ssr: false
});

const LIMIT = 7;

// ── Toast notification system ──────────────────────────────────────────────────
type Toast = { id: number; message: string; type: 'success' | 'error' | 'loading' };
let toastIdCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastIdCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (type !== 'loading') {
      setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ── Per-row, per-action loading tracker ───────────────────────────────────────
type LoadingAction = { deliveryId: number; action: string };

export default function DeliveriesClient({ initialData }: { initialData?: any }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(null);

  // State for per-product manual quota addition
  const [addQuotaInputs, setAddQuotaInputs] = useState<Record<string, number>>({});
  const [addQuotaErrors, setAddQuotaErrors] = useState<Record<string, string>>({});

  const { toasts, show: showToast, dismiss } = useToast();

  const queryKey = ['deliveries', page, LIMIT];

  const { data, isLoading: loading } = useQuery({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/deliveries?page=${page}&limit=${LIMIT}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch deliveries');
      return res.json();
    },
    initialData: page === 1 ? initialData : undefined,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  const deliveries: any[] = data?.data || [];
  const totalCount: number = data?.totalCount || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / LIMIT));

  // ── Optimistic update helper ─────────────────────────────────────────────────
  const optimisticStatusUpdate = useCallback((deliveryId: number, newStatus: string) => {
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((d: any) =>
          d.id === deliveryId ? { ...d, status: newStatus } : d
        )
      };
    });
  }, [queryClient, queryKey]);

  const rollbackStatus = useCallback((deliveryId: number, oldStatus: string) => {
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((d: any) =>
          d.id === deliveryId ? { ...d, status: oldStatus } : d
        )
      };
    });
  }, [queryClient, queryKey]);

  // ── Generic action mutation factory ─────────────────────────────────────────
  const makeActionMutation = (
    action: string,
    endpoint: (id: number) => string,
    optimisticStatus: string,
    successMsg: string
  ) => {
    return useMutation<any, Error, number>({
      mutationFn: async (id: number) => {
        const res = await fetch(endpoint(id), {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Failed to ${action}`);
        return { ...data, id };
      },
      onMutate: async (id) => {
        // 1. Cancel in-flight refetches to prevent race conditions
        await queryClient.cancelQueries({ queryKey });
        // 2. Snapshot old status for rollback
        const old = queryClient.getQueryData<any>(queryKey);
        const oldDelivery = old?.data?.find((d: any) => d.id === id);
        // 3. Immediate optimistic update
        optimisticStatusUpdate(id, optimisticStatus);
        setLoadingAction({ deliveryId: id, action });
        return { oldStatus: oldDelivery?.status };
      },
      onSuccess: (_data, id) => {
        showToast(successMsg, 'success');
      },
      onError: (error: any, id, context: any) => {
        // Rollback to old status
        if (context?.oldStatus) rollbackStatus(id, context.oldStatus);
        showToast(error.message || `Failed to ${action}`, 'error');
      },
      onSettled: () => {
        setLoadingAction(null);
      }
    });
  };

  const cancelMutation = makeActionMutation('cancel', id => `/api/deliveries/${id}/cancel`, 'CANCELLED', 'Delivery cancelled.');
  const readyMutation = makeActionMutation('mark ready', id => `/api/deliveries/${id}/ready`, 'READY_FOR_DISPATCH', 'Marked as Ready for Dispatch.');

  // Delete mutation (row is removed from list, not a status change)
  const deleteMutation = useMutation<any, Error, number>({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/deliveries/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      return { id };
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const old = queryClient.getQueryData<any>(queryKey);
      // Optimistically remove the row
      queryClient.setQueryData(queryKey, (prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          totalCount: (prev.totalCount || 1) - 1,
          data: prev.data.filter((d: any) => d.id !== id)
        };
      });
      setLoadingAction({ deliveryId: id, action: 'delete' });
      return { old };
    },
    onSuccess: (_data, id) => {
      showToast('Delivery deleted.', 'success');
      // If we deleted the last item on the page, go back
      const current = queryClient.getQueryData<any>(queryKey);
      if (current?.data?.length === 0 && page > 1) {
        setPage(p => p - 1);
      }
    },
    onError: (error: any, _id, context: any) => {
      if (context?.old) queryClient.setQueryData(queryKey, context.old);
      showToast(error.message || 'Failed to delete', 'error');
    },
    onSettled: () => setLoadingAction(null)
  });

  // Dispatch — goes through modal (which handles stock deduction)
  const handleDispatch = (id: number) => {
    setSelectedDeliveryId(id);
    setIsDispatchModalOpen(true);
  };

  // After dispatch modal completes: optimistic + targeted refetch
  const handleDispatchComplete = useCallback((deliveryId?: number) => {
    if (deliveryId) {
      // Immediately update just that row
      optimisticStatusUpdate(deliveryId, 'DISPATCHED');
    }
    // Refetch only this page to sync with DB (don't refetch everything)
    queryClient.invalidateQueries({ queryKey, exact: true });
  }, [optimisticStatusUpdate, queryClient, queryKey]);

  // Add-quota mutation (per product)
  const addQuotaMutation = useMutation<any, Error, { deliveryId: number; productId: number; quantity: number }>({
    mutationFn: async ({ deliveryId, productId, quantity }: { deliveryId: number; productId: number; quantity: number }) => {
      const res = await fetch(`/api/deliveries/${deliveryId}/products/${productId}/add-quota`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add quota');
      return { ...data, deliveryId, productId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      setAddQuotaInputs(prev => ({ ...prev, [`${data.deliveryId}-${data.productId}`]: 0 }));
      setAddQuotaErrors(prev => ({ ...prev, [`${data.deliveryId}-${data.productId}`]: '' }));
      showToast(`Added ${data.addedCount} to quota`, 'success');
    },
    onError: (error: any, variables) => {
      setAddQuotaErrors(prev => ({ ...prev, [`${variables.deliveryId}-${variables.productId}`]: error.message }));
    }
  });

  const handleAddQuota = (deliveryId: number, productId: number, target: number, current: number) => {
    const key = `${deliveryId}-${productId}`;
    const qty = addQuotaInputs[key] || 0;
    const remaining = target - current;
    if (qty <= 0) { setAddQuotaErrors(prev => ({ ...prev, [key]: 'Enter qty > 0' })); return; }
    if (qty > remaining) { setAddQuotaErrors(prev => ({ ...prev, [key]: `Max: ${remaining}` })); return; }
    setAddQuotaErrors(prev => ({ ...prev, [key]: '' }));
    addQuotaMutation.mutate({ deliveryId, productId, quantity: qty });
  };

  const handleDelete = (id: number, status: string) => {
    if (!['DRAFT', 'CANCELLED'].includes(status)) {
      showToast('Only DRAFT or CANCELLED orders can be deleted. Cancel first.', 'error');
      return;
    }
    if (!confirm('Permanently delete this delivery order? This cannot be undone.')) return;
    deleteMutation.mutate(id);
  };

  const isActing = (id: number, action?: string) =>
    loadingAction?.deliveryId === id && (!action || loadingAction.action === action);

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast container */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{
            padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
            backgroundColor: t.type === 'error' ? '#fef2f2' : t.type === 'loading' ? '#eff6ff' : '#ecfdf5',
            color: t.type === 'error' ? '#dc2626' : t.type === 'loading' ? '#2563eb' : '#16a34a',
            border: `1px solid ${t.type === 'error' ? '#fecaca' : t.type === 'loading' ? '#bfdbfe' : '#bbf7d0'}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            maxWidth: '360px',
            animation: 'fadeInContent 0.2s ease-out',
            pointerEvents: 'auto'
          }}>
            {t.message}
          </div>
        ))}
      </div>

      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Active Deliveries</h1>
          <p>Track, dispatch, and manage your delivery orders</p>
        </div>
      </div>

      <div
        className={styles.card}
        style={{
          padding: '0',
          overflow: 'hidden',
          marginTop: '24px',
          borderRadius: '24px',
          boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)'
        }}
      >
        {/* Toolbar */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.75))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8', fontSize: '13px', fontWeight: 700 }}>
              Total: {totalCount} deliveries
            </div>

          </div>
          <button onClick={() => window.location.href = '/admin/deliveries/create'} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700, borderRadius: '14px', boxShadow: '0 10px 24px rgba(79, 70, 229, 0.25)' }}>
            <Plus size={16} /> Create Delivery
          </button>
        </div>

        <div className={styles.tableContainer} style={{ padding: '0 12px 12px' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: '170px', width: '15%', textAlign: 'center' }}>Order Details</th>
                <th style={{ minWidth: '280px', width: '25%', textAlign: 'center' }}>Location</th>
                <th style={{ minWidth: '150px', width: '15%', textAlign: 'center' }}>Product Name</th>
                <th style={{ minWidth: '160px', width: '15%', textAlign: 'center' }}>Quota Progress</th>
                <th style={{ minWidth: '170px', width: '15%', textAlign: 'center' }}>Partner</th>
                <th style={{ minWidth: '70px', width: '8%', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '90px', width: '7%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody className={!loading ? styles.fadeIn : ''}>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: '36px 24px 42px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>Loading deliveries...</div>
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery: any) => {
                  const rowActing = isActing(delivery.id);

                  return (
                    <tr key={delivery.id} style={{ opacity: rowActing ? 0.75 : 1, transition: 'opacity 0.15s ease' }}>
                      {/* Order Details */}
                      <td style={{ minWidth: '170px', padding: '6px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2, fontSize: '14px' }}>{delivery.customerName}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', lineHeight: 1.35 }}>{delivery.customerContact}</div>
                      </td>

                      {/* Locations */}
                      <td style={{ minWidth: '320px', width: '34%', padding: '4px 2px 4px 6px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-start', textAlign: 'left', margin: '0 auto', width: 'fit-content' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#3b82f6', marginTop: '5px', flexShrink: 0 }} />
                            <div style={{ color: '#475569', fontSize: '14px', maxWidth: '290px', lineHeight: 1.35, textAlign: 'left' }}>{delivery.pickupAddress}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', marginTop: '5px', flexShrink: 0 }} />
                            <div style={{ color: '#475569', fontSize: '14px', maxWidth: '290px', lineHeight: 1.35, textAlign: 'left' }}>{delivery.dropoffAddress}</div>
                          </div>
                          {delivery.finalDeliveryPrice && (
                            <div style={{ marginTop: '4px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                              Fee: {formatCurrency(delivery.finalDeliveryPrice)}
                              {delivery.requiredVehicleType ? ` | Vehicle: ${delivery.requiredVehicleType}` : ''}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Product Name */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px', alignItems: 'center' }}>
                          {delivery.products && delivery.products.length > 0 ? (
                            delivery.products.map((prod: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingBottom: '8px', borderBottom: idx < delivery.products.length - 1 ? '1px dashed #e2e8f0' : 'none', minHeight: '44px', width: '100%' }}>
                                <span style={{ fontWeight: 600, color: '#334155', fontSize: '14px' }}>{prod.productName}</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Quota Progress */}
                      <td style={{ padding: '6px 2px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '120px', alignItems: 'center' }}>
                          {delivery.products && delivery.products.length > 0 ? (
                            delivery.products.map((prod: any, idx: number) => {
                              const accQty = prod.accumulatedQuantity || 0;
                              const targetQty = prod.targetQuantity || 20;
                              const pct = Math.min(100, (accQty / targetQty) * 100);
                              const isReached = accQty >= targetQty;
                              const remaining = targetQty - accQty;
                              const canAddQuota = !['READY_FOR_DISPATCH', 'DISPATCHED', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED'].includes(delivery.status);
                              const inputKey = `${delivery.id}-${prod.productId}`;
                              const inputQty = addQuotaInputs[inputKey] || 0;
                              const errorMsg = addQuotaErrors[inputKey];
                              const isAdding = addQuotaMutation.isPending && addQuotaMutation.variables?.deliveryId === delivery.id && addQuotaMutation.variables?.productId === prod.productId;

                              return (
                                <div key={idx} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px', paddingBottom: '8px', borderBottom: idx < delivery.products.length - 1 ? '1px dashed #e2e8f0' : 'none', minHeight: '44px', width: '100%' }}>
                                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '13px', gap: '8px' }}>
                                    <span style={{ color: isReached ? '#16a34a' : '#3b82f6', fontWeight: 700 }}>
                                      {accQty} / {targetQty}
                                    </span>
                                    {/* Input for manual quota addition */}
                                    {!isReached && canAddQuota && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input
                                          type="number" min={1} max={remaining}
                                          value={inputQty || ''}
                                          onChange={e => {
                                            const v = parseInt(e.target.value, 10);
                                            setAddQuotaInputs(prev => ({ ...prev, [inputKey]: isNaN(v) ? 0 : v }));
                                            setAddQuotaErrors(prev => ({ ...prev, [inputKey]: '' }));
                                          }}
                                          placeholder="Qty"
                                          style={{ width: '55px', padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', textAlign: 'center' }}
                                        />
                                        <button
                                          onClick={() => handleAddQuota(delivery.id, prod.productId, targetQty, accQty)}
                                          disabled={isAdding || remaining <= 0}
                                          style={{ padding: '4px 8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}
                                        >
                                          {isAdding ? '...' : 'Add'}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {errorMsg && canAddQuota && <div style={{ fontSize: '10px', color: '#ef4444', textAlign: 'center' }}>{errorMsg}</div>}
                                  <div style={{ height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
                                    <div style={{ height: '100%', width: `${pct}%`, backgroundColor: isReached ? '#16a34a' : '#3b82f6', borderRadius: '2px', transition: 'width 0.4s ease' }} />
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                          )}
                        </div>
                      </td>

                      {/* Partner */}
                      <td style={{ padding: '8px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                        {delivery.status === 'WAITING_APPROVAL' && delivery.temporaryWinner ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#1e293b', lineHeight: 1.35 }}>
                              {delivery.temporaryWinner.companyName || delivery.temporaryWinner.contactPerson || 'Delivery Partner'}
                            </div>
                            {delivery.temporaryWinner.mobileNumber && (
                              <div style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Phone size={11} /> {delivery.temporaryWinner.mobileNumber}
                              </div>
                            )}
                            {delivery.temporaryWinner.email && (
                              <div style={{ fontSize: '12px', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={11} /> {delivery.temporaryWinner.email}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '12px', color: '#94a3b8' }}>-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <StatusBadge status={delivery.status} />
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'center', verticalAlign: 'middle', padding: '12px 12px', paddingRight: '16px' }}>
                        <ActionMenu actions={[
                          ...(delivery.status === 'DRAFT' ? [
                            { label: 'Edit', icon: <Edit size={14} />, onClick: () => window.location.href = `/admin/deliveries/${delivery.id}/edit`, color: '#3b82f6' },
                            { label: 'Mark Ready', icon: <CheckSquare size={14} />, onClick: () => readyMutation.mutate(delivery.id), color: '#eab308', disabled: isActing(delivery.id, 'mark ready') }
                          ] : []),
                          ...(delivery.status === 'READY_FOR_DISPATCH' ? [
                            { label: 'Dispatch', icon: <Truck size={14} />, onClick: () => handleDispatch(delivery.id), color: '#10b981', disabled: rowActing }
                          ] : []),
                          ...(!['DELIVERED', 'CANCELLED'].includes(delivery.status) ? [
                            { label: 'Cancel', icon: <XCircle size={14} />, onClick: () => { if (confirm('Cancel this delivery?')) cancelMutation.mutate(delivery.id); }, color: '#d97706', disabled: isActing(delivery.id, 'cancel') }
                          ] : []),
                          { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(delivery.id, delivery.status), color: '#ef4444', disabled: isActing(delivery.id, 'delete') }
                        ]} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', background: 'linear-gradient(180deg, rgba(248,250,252,0.8), rgba(255,255,255,0.95))' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, opacity: page === 1 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', padding: '8px 12px', borderRadius: '999px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>Page {page} of {totalPages || 1}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: '12px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontWeight: 700, opacity: page >= totalPages ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <DispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => { setIsDispatchModalOpen(false); setSelectedDeliveryId(null); }}
        deliveryId={selectedDeliveryId}
        onDispatchComplete={() => handleDispatchComplete(selectedDeliveryId ?? undefined)}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = '#475569', bg = '#f1f5f9';
  let Icon: any = Clock;
  if (status === 'READY_FOR_DISPATCH') { color = '#d97706'; bg = '#fef3c7'; Icon = Clock; }
  else if (status === 'DRAFT') { color = '#64748b'; bg = '#f1f5f9'; Icon = Edit; }
  else if (status === 'WAITING_APPROVAL') { color = '#0284c7'; bg = '#e0f2fe'; Icon = Clock; }
  else if (status === 'DISPATCHED' || status === 'ASSIGNED') { color = '#2563eb'; bg = '#dbeafe'; Icon = Truck; }
  else if (status === 'IN_TRANSIT') { color = '#8b5cf6'; bg = '#ede9fe'; Icon = Truck; }
  else if (status === 'DELIVERED') { color = '#16a34a'; bg = '#dcfce7'; Icon = CheckCircle2; }
  else if (status === 'CANCELLED') { color = '#ef4444'; bg = '#fee2e2'; Icon = XCircle; }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', backgroundColor: bg, color, borderRadius: '999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}>
      <Icon size={11} />{status.replace(/_/g, ' ')}
    </span>
  );
}

function HistoryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" /><path d="M12 7v5l4 2" />
    </svg>
  );
}

function formatCurrency(value: string | number) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount);
}
