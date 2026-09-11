'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Truck, XCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Edit, CheckSquare, Trash2, Plus, Mail, Phone, Download } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';
import ExcelJS from 'exceljs';
import dynamic from 'next/dynamic';

const DispatchModal = dynamic(() => import('./DispatchModal').then(m => m.DispatchModal), {
  ssr: false
});

const DeliveryDetailsModal = dynamic(() => import('./DeliveryDetailsModal').then(m => m.DeliveryDetailsModal), {
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
  
  // State for the Delivery Details Modal
  const [viewingDelivery, setViewingDelivery] = useState<any>(null);

  // State for per-product manual quota addition
  const [addQuotaInputs, setAddQuotaInputs] = useState<Record<string, number>>({});
  const [addQuotaErrors, setAddQuotaErrors] = useState<Record<string, string>>({});

  const { toasts, show: showToast, dismiss } = useToast();
  const [exporting, setExporting] = useState(false);

  const exportCompletedDeliveries = async () => {
    try {
      setExporting(true);
      const res = await fetch(`/api/deliveries?page=1&limit=100000`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch deliveries for export');
      const json = await res.json();
      const allData = json.data || [];
      
      const completedData = allData.filter((d: any) => d.status === 'COMPLETED' || d.status === 'DELIVERED');
      
      if (completedData.length === 0) {
        showToast('No completed deliveries found to export.', 'error');
        setExporting(false);
        return;
      }
      
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Completed Deliveries');
      
      sheet.columns = [
        { header: 'Customer Name', key: 'customerName', width: 25 },
        { header: 'Customer Contact', key: 'customerContact', width: 20 },
        { header: 'Pickup Address', key: 'pickupAddress', width: 40 },
        { header: 'Drop-off Address', key: 'dropoffAddress', width: 40 },
        { header: 'Required Vehicle', key: 'requiredVehicle', width: 20 },
        { header: 'Distance (km)', key: 'distanceKm', width: 15 },
        { header: 'Product Amount', key: 'productAmount', width: 22 },
        { header: 'Delivery Fee', key: 'deliveryFee', width: 20 },
        { header: 'Total Order Amount', key: 'totalAmount', width: 25 },
        { header: 'Driver Name', key: 'driverName', width: 25 },
        { header: 'Driver Contact', key: 'driverContact', width: 20 },
        { header: 'Delivery Date', key: 'deliveryDate', width: 18 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 22 },
      ];

      // Style header row
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
      sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
      
      for (const item of completedData) {
        const productAmount = parseFloat(item.offeredAmount || '0');
        const deliveryFee = parseFloat(item.finalDeliveryPrice || '0');
        const totalAmount = productAmount + deliveryFee;

        const row = sheet.addRow({
          customerName: item.customerName || '',
          customerContact: item.customerContact || '',
          pickupAddress: item.pickupAddress || '',
          dropoffAddress: item.dropoffAddress || '',
          requiredVehicle: item.requiredVehicleType || item.preferredVehicle || '',
          distanceKm: item.distanceKm || 0,
          productAmount: productAmount,
          deliveryFee: deliveryFee,
          totalAmount: totalAmount,
          driverName: item.partnerDriverName || '',
          driverContact: item.partnerDriverContact || '',
          deliveryDate: item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : '',
          status: item.status,
          createdAt: new Date(item.createdAt).toLocaleString()
        });

        // Add highlight for customer name
        row.getCell('customerName').font = { bold: true, color: { argb: 'FF0F172A' } };
        row.getCell('customerName').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
        
        row.alignment = { vertical: 'middle' };
      }

      // Format currencies
      ['productAmount', 'deliveryFee', 'totalAmount'].forEach(key => {
        sheet.getColumn(key).numFmt = '"₱"#,##0.00';
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('href', url);
      a.setAttribute('download', `Completed_Deliveries_${new Date().toISOString().split('T')[0]}.xlsx`);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      showToast('Failed to export completed deliveries.', 'error');
    } finally {
      setExporting(false);
    }
  };

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
  const completeMutation = makeActionMutation('complete', id => `/api/deliveries/${id}/complete`, 'DELIVERED', 'Delivery marked as complete.');

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

  // Add-quota mutation (per item)
  const addQuotaMutation = useMutation<any, Error, { deliveryId: number; itemId: number; quantity: number }>({
    mutationFn: async ({ deliveryId, itemId, quantity }: { deliveryId: number; itemId: number; quantity: number }) => {
      const res = await fetch(`/api/deliveries/${deliveryId}/items/${itemId}/add-quota`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add quota');
      return { ...data, deliveryId, itemId };
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previousData = queryClient.getQueryData<any>(queryKey);
      
      // Optimistic update
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          data: old.data.map((d: any) => {
            if (d.id !== variables.deliveryId) return d;
            
            let allReached = true;
            const updatedProducts = d.products.map((p: any) => {
              if (p.itemId === variables.itemId) {
                const newAccQty = (p.accumulatedQuantity || 0) + variables.quantity;
                if (newAccQty < (p.targetQuantity || 20)) {
                  allReached = false;
                }
                return { ...p, accumulatedQuantity: newAccQty };
              }
              if ((p.accumulatedQuantity || 0) < (p.targetQuantity || 20)) {
                allReached = false;
              }
              return p;
            });
            
            // Auto-ready logic
            const newStatus = (allReached && d.status === 'DRAFT') ? 'READY_FOR_DISPATCH' : d.status;
            
            return {
              ...d,
              status: newStatus,
              products: updatedProducts
            };
          })
        };
      });

      // Also update viewingDelivery if it's the one currently open
      setViewingDelivery((prev: any) => {
        if (!prev || prev.id !== variables.deliveryId) return prev;
        
        let allReached = true;
        const updatedProducts = prev.products.map((p: any) => {
          if (p.itemId === variables.itemId) {
            const newAccQty = (p.accumulatedQuantity || 0) + variables.quantity;
            if (newAccQty < (p.targetQuantity || 20)) allReached = false;
            return { ...p, accumulatedQuantity: newAccQty };
          }
          if ((p.accumulatedQuantity || 0) < (p.targetQuantity || 20)) allReached = false;
          return p;
        });
        
        const newStatus = (allReached && prev.status === 'DRAFT') ? 'READY_FOR_DISPATCH' : prev.status;
        
        return {
          ...prev,
          status: newStatus,
          products: updatedProducts
        };
      });


      // Instantly clear the inputs
      setAddQuotaInputs(prev => ({ ...prev, [`${variables.deliveryId}-${variables.itemId}`]: 0 }));
      setAddQuotaErrors(prev => ({ ...prev, [`${variables.deliveryId}-${variables.itemId}`]: '' }));

      return { previousData };
    },
    onSuccess: (data) => {
      // Invalidate silently in the background without showing loading state
      queryClient.invalidateQueries({ queryKey });
      showToast(`Added ${data.addedCount} to quota`, 'success');
    },
    onError: (error: any, variables, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
      setAddQuotaErrors(prev => ({ ...prev, [`${variables.deliveryId}-${variables.itemId}`]: error.message }));
    }
  });

  const handleAddQuota = (deliveryId: number, itemId: number, target: number, current: number) => {
    const key = `${deliveryId}-${itemId}`;
    const qty = addQuotaInputs[key] || 0;
    const remaining = target - current;
    if (qty <= 0) { setAddQuotaErrors(prev => ({ ...prev, [key]: 'Enter qty > 0' })); return; }
    if (qty > remaining) { setAddQuotaErrors(prev => ({ ...prev, [key]: `Max: ${remaining}` })); return; }
    setAddQuotaErrors(prev => ({ ...prev, [key]: '' }));
    addQuotaMutation.mutate({ deliveryId, itemId, quantity: qty });
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
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'nowrap', background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.75))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', borderRadius: '999px', background: '#eff6ff', color: '#1d4ed8', fontSize: '13px', fontWeight: 700 }}>
              Total: {totalCount} deliveries
            </div>

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={exportCompletedDeliveries} disabled={exporting} className={styles.btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700, borderRadius: '14px', color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#e0e7ff' }}>
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export Completed'}
            </button>
            <button onClick={() => window.location.href = '/admin/deliveries/create'} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 700, borderRadius: '14px', boxShadow: '0 10px 24px rgba(79, 70, 229, 0.25)' }}>
              <Plus size={16} /> Create Delivery
            </button>
          </div>
        </div>

        <div className={styles.tableContainer} style={{ padding: '0 12px 12px' }}>
          <div className="table-responsive-wrapper">
            <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: '170px', width: '25%', textAlign: 'center' }}>Customer</th>
                <th style={{ minWidth: '150px', width: '25%', textAlign: 'center' }}>Delivery Date</th>
                <th style={{ minWidth: '120px', width: '20%', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '90px', width: '15%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody className={!loading ? styles.fadeIn : ''}>
              {loading ? (
                <tr>
                  <td colSpan={4} style={{ padding: '36px 24px 42px', display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>Loading deliveries...</div>
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery: any) => {
                  const rowActing = isActing(delivery.id);

                  return (
                    <tr 
                      key={delivery.id} 
                      onClick={() => setViewingDelivery(delivery)}
                      style={{ 
                        opacity: rowActing ? 0.75 : 1, 
                        transition: 'opacity 0.15s ease',
                        cursor: 'pointer' 
                      }}
                      className={styles.clickableRow}
                    >
                      {/* Customer Details */}
                      <td style={{ minWidth: '170px', padding: '16px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2, fontSize: '14px' }}>{delivery.customerName}</div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: 1.35 }}>{delivery.customerContact || 'No contact'}</div>
                      </td>

                      {/* Delivery Date */}
                      <td style={{ minWidth: '150px', padding: '16px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                          {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '16px 12px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <StatusBadge status={delivery.status} />
                      </td>

                      {/* Actions */}
                      <td 
                        style={{ textAlign: 'center', verticalAlign: 'middle', padding: '16px 12px', paddingRight: '16px' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionMenu actions={[
                          ...(delivery.status === 'DRAFT' ? [
                            { label: 'Edit', icon: <Edit size={14} />, onClick: () => window.location.href = `/admin/deliveries/${delivery.id}/edit`, color: '#3b82f6' },
                            { label: 'Mark Ready', icon: <CheckSquare size={14} />, onClick: () => readyMutation.mutate(delivery.id), color: '#eab308', disabled: isActing(delivery.id, 'mark ready') }
                          ] : []),
                          ...(delivery.status === 'READY_FOR_DISPATCH' ? [
                            { label: 'Dispatch', icon: <Truck size={14} />, onClick: () => handleDispatch(delivery.id), color: '#10b981', disabled: rowActing }
                          ] : []),
                          ...(['IN_TRANSIT'].includes(delivery.status) ? [
                            { label: 'Complete Order', icon: <CheckSquare size={14} />, onClick: () => { if (confirm('Mark this delivery as completed?')) completeMutation.mutate(delivery.id); }, color: '#10b981', disabled: isActing(delivery.id, 'complete') }
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

      <DeliveryDetailsModal
        isOpen={!!viewingDelivery}
        onClose={() => setViewingDelivery(null)}
        delivery={viewingDelivery}
        addQuotaInputs={addQuotaInputs}
        setAddQuotaInputs={setAddQuotaInputs}
        addQuotaErrors={addQuotaErrors}
        setAddQuotaErrors={setAddQuotaErrors}
        handleAddQuota={handleAddQuota}
        isAdding={(deliveryId, itemId) => 
          addQuotaMutation.isPending && 
          addQuotaMutation.variables?.deliveryId === deliveryId && 
          addQuotaMutation.variables?.itemId === itemId
        }
        onDispatch={() => {
          setViewingDelivery(null);
          handleDispatch(viewingDelivery.id);
        }}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = '#475569', bg = '#f1f5f9';
  let Icon: any = Clock;
  let displayStatus = status;

  if (status === 'READY_FOR_DISPATCH') { color = '#d97706'; bg = '#fef3c7'; Icon = Clock; displayStatus = 'READY FOR DISPATCH'; }
  else if (status === 'DRAFT') { color = '#64748b'; bg = '#f1f5f9'; Icon = Edit; }
  else if (status === 'WAITING_APPROVAL') { color = '#0284c7'; bg = '#e0f2fe'; Icon = Clock; displayStatus = 'WAITING APPROVAL'; }
  else if (status === 'DISPATCHED') { color = '#2563eb'; bg = '#dbeafe'; Icon = Truck; displayStatus = 'AVAILABLE'; }
  else if (status === 'ASSIGNED') { color = '#2563eb'; bg = '#dbeafe'; Icon = Truck; displayStatus = 'ACCEPTED'; }
  else if (status === 'IN_TRANSIT') { color = '#8b5cf6'; bg = '#ede9fe'; Icon = Truck; displayStatus = 'IN TRANSIT'; }
  else if (status === 'DELIVERED') { color = '#16a34a'; bg = '#dcfce7'; Icon = CheckCircle2; }
  else if (status === 'COMPLETED') { color = '#16a34a'; bg = '#dcfce7'; Icon = CheckCircle2; }
  else if (status === 'CANCELLED') { color = '#ef4444'; bg = '#fee2e2'; Icon = XCircle; }
  
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 9px', backgroundColor: bg, color, borderRadius: '999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', transition: 'all 0.2s ease' }}>
      <Icon size={11} />{displayStatus}
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
