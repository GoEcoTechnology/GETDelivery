'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styles from '../admin.module.css';
import { Truck, XCircle, Clock, CheckCircle2, ChevronRight, ChevronLeft, Edit, CheckSquare, Trash2, Plus, Mail, Phone, Download, Package, MapPin, Calendar, Zap, Info, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { ActionMenu } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';
import ExcelJS from 'exceljs';
import dynamic from 'next/dynamic';

const DispatchModal = dynamic(() => import('./DispatchModal').then(m => m.DispatchModal), {
  ssr: false
});

const DeliveryDetailsModal = dynamic(() => import('./DeliveryDetailsModal').then(m => m.DeliveryDetailsModal), {
  ssr: false
});

const CreateDeliveryModal = dynamic(() => import('./CreateDeliveryModal'), {
  ssr: false
});

const AddCustomerModal = dynamic(() => import('./AddCustomerModal').then(m => m.AddCustomerModal), {
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

export default function DeliveriesClient({ initialData, defaultTab }: { initialData?: any; defaultTab?: 'CREATED' | 'MARKETPLACE' | 'COMPLETED' }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<number | null>(null);
  const [dispatchModalType, setDispatchModalType] = useState<'delivery' | 'batch'>('delivery');
  const [loadingAction, setLoadingAction] = useState<LoadingAction | null>(null);
  
  // Tabs: 'CREATED' vs 'MARKETPLACE' vs 'COMPLETED'
  const [activeTab, setActiveTab] = useState<'CREATED' | 'MARKETPLACE' | 'COMPLETED'>(defaultTab || 'MARKETPLACE');
  const [completedFilter, setCompletedFilter] = useState<'ALL' | 'MARKETPLACE' | 'CREATED'>('ALL');

  const { data: marketplaceBatches = initialData?.batches || [] } = useQuery({
    queryKey: ['admin-marketplace-deliveries'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deliveries/marketplace', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch marketplace deliveries');
      return res.json();
    },
    enabled: activeTab === 'MARKETPLACE' || activeTab === 'COMPLETED',
    staleTime: 10 * 1000,
    refetchInterval: 15_000,
  });

  const { data: completedCreatedDeliveries = [] } = useQuery({
    queryKey: ['admin-completed-created-deliveries'],
    queryFn: async () => {
      const res = await fetch('/api/deliveries?page=1&limit=500', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || []).filter((d: any) => d.status === 'DELIVERED' || d.status === 'COMPLETED');
    },
    enabled: activeTab === 'COMPLETED',
    staleTime: 30 * 1000,
    refetchInterval: activeTab === 'COMPLETED' ? 15_000 : false,
  });

  const batches = (marketplaceBatches || []).filter((b: any) => b.status !== 'DRAFT');
  const activeBatches = batches.filter((b: any) => b.status !== 'DELIVERED' && b.status !== 'COMPLETED');
  const completedBatches = batches.filter((b: any) => b.status === 'DELIVERED' || b.status === 'COMPLETED');

  // State to track expanded dropdown batches
  const [expandedBatches, setExpandedBatches] = useState<Set<number>>(new Set());

  const toggleBatch = (batchId: number) => {
    setExpandedBatches(prev => {
      const next = new Set(prev);
      if (next.has(batchId)) {
        next.delete(batchId);
      } else {
        next.add(batchId);
      }
      return next;
    });
  };

  const [completingBatchId, setCompletingBatchId] = useState<number | null>(null);

  const completeBatchMutation = useMutation({
    mutationFn: async (batchId: number) => {
      setCompletingBatchId(batchId);
      const res = await fetch(`/api/deliveries/batches/${batchId}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to complete batch order');
      return data;
    },
    onSuccess: () => {
      showToast('Order completed successfully! Moved to Completed Deliveries.', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin-marketplace-deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-batches'] });
      queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['company-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['admin-completed-created-deliveries'] });
    },
    onError: (err: any) => {
      showToast(err.message || 'Failed to complete order', 'error');
    },
    onSettled: () => {
      setCompletingBatchId(null);
    }
  });

  // State for the Delivery Details Modal
  const [viewingDelivery, setViewingDelivery] = useState<any>(null);
  
  // State for Batch Customers Modal
  const [selectedBatchForModal, setSelectedBatchForModal] = useState<any>(null);

  // State for Create Delivery Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // State for Add Customer modal
  const [addCustomerContext, setAddCustomerContext] = useState<any>(null);

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
      
      if (completedData.length === 0 && completedBatches.length === 0) {
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

      // Also export completed marketplace batch items
      for (const batch of completedBatches) {
        for (const item of (batch.items || [])) {
          const qty = Number(item.quantity) || 1;
          let productAmount = Number(item.offeredAmount);
          if (!productAmount) {
            productAmount = qty * Number(batch.variantPrice || 0);
          }
          const deliveryFee = Number(item.finalDeliveryPrice) || (Number(item.normalDeliveryFee || 0) + Number(item.urgentAdditionalFee || 0));
          const totalAmount = productAmount + deliveryFee;

          const row = sheet.addRow({
            customerName: item.customerName || '',
            customerContact: item.customerContact || '',
            pickupAddress: batch.pickupLocation || '',
            dropoffAddress: item.dropoffAddress || '',
            requiredVehicle: batch.ownVehicleType || '',
            distanceKm: item.distanceKm || item.routeDistance || 0,
            productAmount: productAmount,
            deliveryFee: deliveryFee,
            totalAmount: totalAmount,
            driverName: batch.ownDriverName || batch.partnerDriverName || '',
            driverContact: batch.partnerDriverContact || '',
            deliveryDate: item.deliveryDate ? new Date(item.deliveryDate).toLocaleDateString() : (batch.createdAt ? new Date(batch.createdAt).toLocaleDateString() : ''),
            status: batch.status,
            createdAt: new Date(batch.createdAt).toLocaleString()
          });
          row.getCell('customerName').font = { bold: true, color: { argb: 'FF0F172A' } };
          row.getCell('customerName').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
          row.alignment = { vertical: 'middle' };
        }
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
    enabled: activeTab === 'CREATED' || activeTab === 'COMPLETED',
    staleTime: 10 * 1000,
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
        queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
        queryClient.invalidateQueries({ queryKey: ['company-vehicles'] });
        queryClient.invalidateQueries({ queryKey: ['admin-completed-created-deliveries'] });
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
    setDispatchModalType('delivery');
    setIsDispatchModalOpen(true);
  };

  const handleBatchDispatch = (id: number) => {
    setSelectedDeliveryId(id);
    setDispatchModalType('batch');
    setIsDispatchModalOpen(true);
  };

  // After dispatch modal completes: optimistic + targeted refetch
  const handleDispatchComplete = useCallback((deliveryId?: number) => {
    if (deliveryId) {
      // Immediately update just that row
      optimisticStatusUpdate(deliveryId, 'WAITING_FOR_PARTNER');
    }
    // Refetch only this page to sync with DB (don't refetch everything)
    queryClient.invalidateQueries({ queryKey, exact: true });
    queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
    queryClient.invalidateQueries({ queryKey: ['company-vehicles'] });
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
                if (newAccQty < (p.targetQuantity || 0)) {
                  allReached = false;
                }
                return { ...p, accumulatedQuantity: newAccQty };
              }
              if ((p.accumulatedQuantity || 0) < (p.targetQuantity || 0)) {
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
            if (newAccQty < (p.targetQuantity || 0)) allReached = false;
            return { ...p, accumulatedQuantity: newAccQty };
          }
          if ((p.accumulatedQuantity || 0) < (p.targetQuantity || 0)) allReached = false;
          return p;
        });
        
        const newStatus = (allReached && prev.status === 'DRAFT') ? 'READY_FOR_DISPATCH' : prev.status;
        
        return {
          ...prev,
          status: newStatus,
          products: updatedProducts
        };
      });

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
      showToast(error.message || 'Failed to update quota', 'error');
    }
  });

  // Open the Add Customer modal with context
  const handleOpenAddCustomer = (
    deliveryId: number, itemId: number, productId: number, variantId: number,
    productName: string, variantName: string, unit: string | null,
    sellingUnits: any[], targetQuantity: number, currentAccumulated: number, pickupAddress: string
  ) => {
    setAddCustomerContext({ deliveryId, itemId, productId, variantId, productName, variantName, unit, sellingUnits, targetQuantity, currentAccumulated, pickupAddress });
    setViewingDelivery(null); // Close the DeliveryDetailsModal when adding a customer
  };

  // Called after AddCustomerModal successfully submits
  const handleAddCustomerSuccess = (deliveryId: number, addedCount: number) => {
    let finalStatus = 'DRAFT';
    
    // Optimistically update the viewing delivery's accumulated quantity
    setViewingDelivery((prev: any) => {
      if (!prev || prev.id !== deliveryId) return prev;
      let allReached = true;
      const updatedProducts = prev.products.map((p: any) => {
        let newAcc = p.accumulatedQuantity || 0;
        if (p.productId === addCustomerContext?.productId && p.variantId === addCustomerContext?.variantId) {
          newAcc = newAcc + addedCount;
        }
        if (newAcc < (p.targetQuantity || 0)) allReached = false;
        return { ...p, accumulatedQuantity: newAcc };
      });
      const newStatus = (allReached && prev.status === 'DRAFT') ? 'READY_FOR_DISPATCH' : prev.status;
      finalStatus = newStatus;
      return { ...prev, products: updatedProducts, status: newStatus };
    });

    // Update queryClient list data optimistically
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      return {
        ...old,
        data: old.data.map((d: any) => {
          if (d.id !== deliveryId) return d;
          let allReached = true;
          const updatedProducts = d.products.map((p: any) => {
            let newAcc = p.accumulatedQuantity || 0;
            if (p.productId === addCustomerContext?.productId && p.variantId === addCustomerContext?.variantId) {
              newAcc = newAcc + addedCount;
            }
            if (newAcc < (p.targetQuantity || 0)) allReached = false;
            return { ...p, accumulatedQuantity: newAcc };
          });
          const newStatus = (allReached && d.status === 'DRAFT') ? 'READY_FOR_DISPATCH' : d.status;
          return { ...d, products: updatedProducts, status: newStatus };
        })
      };
    });

    // Also update context so the modal shows correct remaining
    setAddCustomerContext((prev: any) => prev ? { ...prev, currentAccumulated: (prev.currentAccumulated || 0) + addedCount } : prev);
    showToast(`Customer added — ${addedCount} unit${addedCount > 1 ? 's' : ''} added to quota`, 'success');
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ['delivery-customers', deliveryId] });
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

  const renderBatchCard = (batch: any, isCompletedView: boolean = false) => {
    const isExpanded = expandedBatches.has(batch.id);

    return (
      <div 
        key={batch.id} 
        className={styles.card} 
        style={{ 
          padding: 0, 
          overflow: 'hidden', 
          border: isCompletedView 
            ? (isExpanded ? '1.5px solid #16a34a' : '1px solid #bbf7d0') 
            : (isExpanded ? '1.5px solid #6366f1' : '1px solid #e2e8f0'), 
          borderRadius: '16px', 
          boxShadow: isExpanded 
            ? '0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.01)' 
            : '0 2px 4px rgba(0, 0, 0, 0.02)',
          transition: 'all 0.2s ease'
        }}
      >
        <div 
          onClick={() => toggleBatch(batch.id)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleBatch(batch.id);
            }
          }}
          style={{ 
            padding: '20px', 
            borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none', 
            background: isCompletedView 
              ? (isExpanded ? 'linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%)' : 'white') 
              : (isExpanded ? 'linear-gradient(90deg, #faf5ff 0%, #f8faff 100%)' : 'white'), 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: isCompletedView ? '#dcfce7' : '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px', flexShrink: 0 }}>
              <Truck size={24} color={isCompletedView ? '#16a34a' : '#4f46e5'} />
            </div>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>{batch.productName}</h3>
              <div style={{ fontSize: '14px', color: '#64748b', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: isCompletedView ? '#16a34a' : '#4f46e5' }}>{batch.variantName}</span>
                <span>•</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', padding: '2px 8px', borderRadius: '6px' }}>
                  {(batch.items || []).length} {(batch.items || []).length === 1 ? 'Customer Drop' : 'Customer Drops'}
                </span>
              </div>
              <div style={{ fontSize: '13px', color: '#334155', display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: batch.fleetType === 'PARTNER_FLEET' ? '#7c3aed' : '#1d4ed8',
                  background: batch.fleetType === 'PARTNER_FLEET' ? '#f5f3ff' : '#eff6ff',
                  border: `1px solid ${batch.fleetType === 'PARTNER_FLEET' ? '#ddd6fe' : '#bfdbfe'}`,
                  padding: '3px 8px',
                  borderRadius: '999px'
                }}>
                  {batch.fleetType === 'PARTNER_FLEET' ? 'PARTNER FLEET' : 'OWN FLEET'}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px' }}>
                  <Users size={13} color="#64748b" />
                  <span style={{ fontWeight: 600 }}>Driver: <strong style={{ color: (batch.driverName || batch.ownDriverName || batch.partnerDriverName) ? '#0f172a' : '#94a3b8' }}>
                    {batch.driverName || batch.ownDriverName || batch.partnerDriverName || 'Not assigned'}
                  </strong></span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px' }}>
                  <Truck size={13} color="#64748b" />
                  <span style={{ fontWeight: 600 }}>Vehicle: <strong style={{ color: (batch.vehicleDetails || batch.ownVehicleType || batch.suggestedVehicleType) ? '#0f172a' : '#94a3b8' }}>
                    {batch.vehicleDetails || batch.ownVehicleType || batch.suggestedVehicleType || 'Not specified'}
                  </strong></span>
                </div>

                {batch.partnerDriverContact && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#f8fafc', border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: '6px' }}>
                    <Phone size={13} color="#64748b" />
                    <span style={{ fontWeight: 600, color: '#334155' }}>{batch.partnerDriverContact}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
              <StatusBadge status={batch.status} />
              <div style={{ color: isCompletedView ? '#16a34a' : '#4f46e5', fontWeight: 800, fontSize: '15px' }}>{batch.totalQuantity} / {batch.quotaQuantity} Quota Reached</div>
              {Number(batch.totalWeight) > 0 && (
                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, background: '#f1f5f9', padding: '4px 8px', borderRadius: '4px' }}>
                  Total: {batch.totalWeight} kg
                </div>
              )}
            </div>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: isExpanded ? (isCompletedView ? '#dcfce7' : '#e0e7ff') : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                color: isExpanded ? (isCompletedView ? '#16a34a' : '#4f46e5') : '#64748b'
              }}
            >
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>

        {/* Collapsible Dropdown Content */}
        {isExpanded && (
          <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ padding: '24px', background: '#f8fafc' }}>
              <div style={{ width: '100%', overflowX: 'auto', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                      <th style={{ padding: '14px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', letterSpacing: '0.05em' }}>CUSTOMER</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', letterSpacing: '0.05em' }}>DROP OFF</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', letterSpacing: '0.05em', textAlign: 'center' }}>QTY</th>
                      <th style={{ padding: '14px 16px', fontWeight: 700, color: '#475569', fontSize: '12px', letterSpacing: '0.05em', textAlign: 'right' }}>AMOUNT AND FEE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const groupedItemsMap = new Map();
                      
                      (batch.items || []).forEach((item: any) => {
                        const key = `${item.customerName || ''}-${item.customerContact || ''}-${item.dropoffAddress || ''}`;
                        if (groupedItemsMap.has(key)) {
                          const existing = groupedItemsMap.get(key);
                          existing.quantity = (Number(existing.quantity) || 1) + (Number(item.quantity) || 1);
                          existing.products = [...(existing.products || []), ...(item.products || [])];
                          existing.offeredAmount = (Number(existing.offeredAmount) || 0) + (Number(item.offeredAmount) || 0);
                          existing.finalDeliveryPrice = (Number(existing.finalDeliveryPrice) || 0) + (Number(item.finalDeliveryPrice) || 0);
                          existing.normalDeliveryFee = (Number(existing.normalDeliveryFee) || 0) + (Number(item.normalDeliveryFee) || 0);
                          existing.urgentAdditionalFee = (Number(existing.urgentAdditionalFee) || 0) + (Number(item.urgentAdditionalFee) || 0);
                        } else {
                          groupedItemsMap.set(key, { ...item, quantity: Number(item.quantity) || 1 });
                        }
                      });
                      
                      const groupedItems = Array.from(groupedItemsMap.values());
                      
                      return groupedItems.map((item: any, idx: number) => {
                         const qty = Number(item.quantity) || 1;
                         let productAmount = Number(item.offeredAmount);
                         if (!productAmount) {
                             productAmount = qty * Number(batch.variantPrice || 0);
                         }
                         const fee = Number(item.finalDeliveryPrice) || (Number(item.normalDeliveryFee || 0) + Number(item.urgentAdditionalFee || 0));
                         
                         return (
                           <tr key={item.id || idx} style={{ borderBottom: idx < groupedItems.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                             <td style={{ padding: '16px', fontWeight: 700, color: '#0f172a' }}>
                               {item.customerName || 'Unknown'}
                               <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 500, marginTop: '2px' }}>{item.customerContact || ''}</div>
                               {(item.products || []).length > 0 && (
                                 <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                   {(item.products || []).map((p: any, pi: number) => (
                                     <div key={p.itemId || pi} style={{ fontSize: '12px', fontWeight: 500, color: '#475569', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                       <Package size={12} color="#94a3b8" style={{ flexShrink: 0 }} />
                                       <span>{p.productName}{p.variantName ? ` - ${p.variantName}` : ''}</span>
                                       <strong style={{ color: '#0f172a' }}>× {p.quantity}{p.unit && !['piece', 'pcs', 'pieces', 'piece (s)'].includes(String(p.unit).toLowerCase()) ? ` ${p.unit}` : ''}</strong>
                                     </div>
                                   ))}
                                 </div>
                               )}
                             </td>
                             <td style={{ padding: '16px', color: '#475569', maxWidth: '300px' }}>
                               <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: '6px' }} title={item.dropoffAddress}>
                                 <MapPin size={14} color="#94a3b8" style={{ flexShrink: 0 }} />
                                 {item.dropoffAddress || 'No Address provided'}
                               </div>
                             </td>
                             <td style={{ padding: '16px', fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                               <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px 12px', borderRadius: '12px' }}>{qty}</div>
                             </td>
                             <td style={{ padding: '16px', textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '15px' }}>₱{formatCurrency(productAmount)}</div>
                                <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '4px' }}>
                                  Fee: ₱{formatCurrency(fee)}
                                  {item.deliveryPriority === 'URGENT' && <span style={{ color: '#ef4444', marginLeft: '6px', fontSize: '11px', background: '#fef2f2', padding: '2px 6px', borderRadius: '4px' }}>URGENT</span>}
                                </div>
                             </td>
                           </tr>
                         );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Grand totals */}
              {(() => {
                const totalProduct = (batch.items || []).reduce((sum: number, item: any) => {
                  const amount = Number(item.offeredAmount);
                  return sum + (amount > 0 ? amount : Number(item.quantity || 0) * Number(batch.variantPrice || 0));
                }, 0);
                const totalDelivery = (batch.items || []).reduce((sum: number, item: any) => sum + (Number(item.finalDeliveryPrice) || (Number(item.normalDeliveryFee || 0) + Number(item.urgentAdditionalFee || 0))), 0);
                const grandTotal = totalProduct + totalDelivery;
                
                return (
                  <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                    <div style={{ width: '320px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '12px' }}>
                        <span>Product Amount</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₱{formatCurrency(totalProduct)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                        <span>Batch Delivery Fee</span>
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>₱{formatCurrency(totalDelivery)}</span>
                      </div>
                      <div style={{ height: '1px', background: '#e2e8f0', margin: '0 -20px 16px -20px' }}></div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Grand Total</span>
                        <span style={{ color: isCompletedView ? '#16a34a' : '#4f46e5', fontWeight: 800, fontSize: '20px' }}>₱{formatCurrency(grandTotal)}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            
            {/* Actions for Batch */}
            <div style={{ padding: '16px 24px', background: isCompletedView ? '#f8fafc' : 'white', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              {isCompletedView ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a', fontWeight: 700, fontSize: '13px' }}>
                    <CheckCircle2 size={18} />
                    <span>Delivery Successfully Fulfilled & Completed</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
                    Batch ID: #{batch.id} • {batch.batchNumber || `Batch-${batch.id}`}
                  </div>
                </>
              ) : (
                <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                  {batch.status === 'READY_FOR_DELIVERY' && (
                    <button 
                      onClick={() => handleBatchDispatch(batch.id)}
                      className={styles.btnPrimary} 
                      style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600 }}
                    >
                      Dispatch Delivery
                    </button>
                  )}

                  {/* If batch was broadcasted or delivery partner is used, show delivery partner notice instead of Complete button */}
                  {(batch.isPartner || batch.fleetType === 'PARTNER_FLEET' || ['WAITING_FOR_PARTNER', 'ACCEPTED'].includes(batch.status)) && (
                    <div style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#4f46e5',
                      background: '#eef2ff',
                      border: '1px solid #c7d2fe',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Truck size={15} />
                      <span>{batch.status === 'WAITING_FOR_PARTNER' ? 'Broadcasted • Waiting for partner acceptance' : 'Dispatched to Delivery Partner • Completed by partner on delivery'}</span>
                    </div>
                  )}

                  {/* ONLY show Complete Delivery button if the business owner used OWN FLEET */}
                  {['DISPATCHED', 'IN_TRANSIT'].includes(batch.status) && (batch.isOwnFleet || batch.fleetType === 'OWN_FLEET') && (
                    <button
                      onClick={() => {
                        if (confirm('Mark this batch order as completed? This will mark all customer orders as delivered and free up your assigned driver and vehicle.')) {
                          completeBatchMutation.mutate(batch.id);
                        }
                      }}
                      disabled={completingBatchId === batch.id}
                      style={{
                        padding: '9px 20px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: 700,
                        backgroundColor: '#16a34a',
                        color: 'white',
                        border: 'none',
                        cursor: completingBatchId === batch.id ? 'not-allowed' : 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)',
                        transition: 'all 0.2s',
                        opacity: completingBatchId === batch.id ? 0.7 : 1
                      }}
                    >
                      <CheckSquare size={16} />
                      <span>{completingBatchId === batch.id ? 'Completing...' : 'Complete Delivery'}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const totalCompletedCount = completedBatches.length + completedCreatedDeliveries.length;

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
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(226, 232, 240, 0.8)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(248,250,252,0.75))' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setActiveTab('CREATED')}
                style={{ padding: '6px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: activeTab === 'CREATED' ? '#4f46e5' : '#e2e8f0', background: activeTab === 'CREATED' ? '#4f46e5' : 'white', color: activeTab === 'CREATED' ? 'white' : '#64748b', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Package size={16} /> Created Deliveries
              </button>
              <button
                onClick={() => setActiveTab('MARKETPLACE')}
                style={{ padding: '6px 14px', borderRadius: '999px', border: '1.5px solid', borderColor: activeTab === 'MARKETPLACE' ? '#4f46e5' : '#e2e8f0', background: activeTab === 'MARKETPLACE' ? '#4f46e5' : 'white', color: activeTab === 'MARKETPLACE' ? 'white' : '#64748b', fontWeight: 700, fontSize: '13px', cursor: 'pointer', transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
              >
                <Truck size={16} /> Marketplace Deliveries
                {activeBatches.length > 0 && (
                  <span style={{ background: activeTab === 'MARKETPLACE' ? 'rgba(255,255,255,0.25)' : '#e0e7ff', color: activeTab === 'MARKETPLACE' ? 'white' : '#4f46e5', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                    {activeBatches.length}
                  </span>
                )}
              </button>
            </div>

          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {activeTab === 'CREATED' && (
              <>
                <button onClick={exportCompletedDeliveries} disabled={exporting} className={styles.btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontWeight: 700, borderRadius: '12px', color: '#4f46e5', borderColor: '#c7d2fe', backgroundColor: '#e0e7ff', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  <Download size={16} /> {exporting ? 'Exporting...' : 'Export Completed'}
                </button>
                <button onClick={() => setIsCreateModalOpen(true)} className={styles.btnPrimary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', fontWeight: 700, borderRadius: '12px', boxShadow: '0 10px 24px rgba(79, 70, 229, 0.25)', whiteSpace: 'nowrap', fontSize: '13px' }}>
                  <Plus size={16} /> Create Delivery
                </button>
              </>
            )}
            {activeTab === 'COMPLETED' && (
              <button onClick={exportCompletedDeliveries} disabled={exporting} className={styles.btnSecondary} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontWeight: 700, borderRadius: '12px', color: '#16a34a', borderColor: '#bbf7d0', backgroundColor: '#f0fdf4', whiteSpace: 'nowrap', fontSize: '13px' }}>
                <Download size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
              </button>
            )}
          </div>
        </div>

        {activeTab === 'MARKETPLACE' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: '#f8fafc' }}>
            {activeBatches.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px 0' }}>
                <EmptyState
                  icon={Package}
                  title="NO ACTIVE MARKETPLACE DELIVERIES"
                  description={completedBatches.length > 0
                    ? `All active marketplace batches have been completed. You have ${completedBatches.length} fulfilled ${completedBatches.length === 1 ? 'delivery' : 'deliveries'} in the Completed Deliveries tab.`
                    : "Batches are intelligently and automatically generated the moment a product variant hits its target quota."}
                />
                {completedBatches.length > 0 && (
                  <button
                    onClick={() => setActiveTab('COMPLETED')}
                    style={{
                      padding: '9px 18px',
                      borderRadius: '12px',
                      backgroundColor: '#16a34a',
                      color: 'white',
                      border: 'none',
                      fontWeight: 700,
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
                    }}
                  >
                    <CheckCircle2 size={16} />
                    <span>View Completed Deliveries ({completedBatches.length})</span>
                  </button>
                )}
              </div>
            ) : (
              activeBatches.map((batch: any) => renderBatchCard(batch, false))
            )}
          </div>
        )}

        {activeTab === 'COMPLETED' && (
          <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', background: '#f8fafc' }}>



            {/* Summary Header Card */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '18px 24px',
              background: 'white',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              flexWrap: 'wrap',
              gap: '16px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={24} color="#16a34a" />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    Completed Deliveries Archive
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} className="retention-info-icon">
                      <Info size={15} color="#94a3b8" style={{ cursor: 'pointer', flexShrink: 0 }} />
                      <span style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: '#1e293b',
                        color: 'white',
                        fontSize: '12px',
                        fontWeight: 400,
                        lineHeight: '1.5',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        width: '280px',
                        whiteSpace: 'normal',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        pointerEvents: 'none',
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        zIndex: 100
                      }} className="retention-tooltip">
                        <strong style={{ color: '#fbbf24' }}>Data Retention Policy</strong><br />
                        Completed delivery records are automatically removed from the database <strong>30 days after completion</strong>. Export to Excel to preserve historical data.
                      </span>
                    </span>
                  </h2>
                  <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                    Archived record of all fulfilled orders ({completedBatches.length} Marketplace {completedBatches.length === 1 ? 'batch' : 'batches'}, {completedCreatedDeliveries.length} Created {completedCreatedDeliveries.length === 1 ? 'delivery' : 'deliveries'})
                  </p>
                </div>
              </div>

              {/* Subfilter Pills */}
              <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
                <button
                  onClick={() => setCompletedFilter('ALL')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: completedFilter === 'ALL' ? 'white' : 'transparent',
                    color: completedFilter === 'ALL' ? '#0f172a' : '#64748b',
                    fontWeight: completedFilter === 'ALL' ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: completedFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  All ({totalCompletedCount})
                </button>
                <button
                  onClick={() => setCompletedFilter('MARKETPLACE')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: completedFilter === 'MARKETPLACE' ? 'white' : 'transparent',
                    color: completedFilter === 'MARKETPLACE' ? '#0f172a' : '#64748b',
                    fontWeight: completedFilter === 'MARKETPLACE' ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: completedFilter === 'MARKETPLACE' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Marketplace ({completedBatches.length})
                </button>
                <button
                  onClick={() => setCompletedFilter('CREATED')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '8px',
                    border: 'none',
                    background: completedFilter === 'CREATED' ? 'white' : 'transparent',
                    color: completedFilter === 'CREATED' ? '#0f172a' : '#64748b',
                    fontWeight: completedFilter === 'CREATED' ? 700 : 500,
                    fontSize: '12px',
                    cursor: 'pointer',
                    boxShadow: completedFilter === 'CREATED' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
                  }}
                >
                  Created ({completedCreatedDeliveries.length})
                </button>
              </div>
            </div>

            {/* Empty state if nothing matches */}
            {((completedFilter === 'ALL' && totalCompletedCount === 0) ||
              (completedFilter === 'MARKETPLACE' && completedBatches.length === 0) ||
              (completedFilter === 'CREATED' && completedCreatedDeliveries.length === 0)) ? (
              <EmptyState
                icon={CheckCircle2}
                title="NO COMPLETED DELIVERIES"
                description="Fulfilled deliveries that have been marked as complete will appear here."
              />
            ) : (
              <>
                {/* Marketplace Batches */}
                {(completedFilter === 'ALL' || completedFilter === 'MARKETPLACE') && completedBatches.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {completedFilter === 'ALL' && (
                      <h3 style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={18} color="#16a34a" /> Marketplace Batches ({completedBatches.length})
                      </h3>
                    )}
                    {completedBatches.map((batch: any) => renderBatchCard(batch, true))}
                  </div>
                )}

                {/* Created Deliveries Table */}
                {(completedFilter === 'ALL' || completedFilter === 'CREATED') && completedCreatedDeliveries.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: completedFilter === 'ALL' && completedBatches.length > 0 ? '12px' : '0' }}>
                    {completedFilter === 'ALL' && (
                      <h3 style={{ margin: '8px 0 0', fontSize: '15px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Package size={18} color="#16a34a" /> Created Deliveries ({completedCreatedDeliveries.length})
                      </h3>
                    )}
                    <div className={styles.tableContainer} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                      <div className="table-responsive-wrapper">
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th style={{ minWidth: '180px', width: '25%', textAlign: 'left', paddingLeft: '16px' }}>Product / Order</th>
                              <th style={{ minWidth: '150px', width: '20%', textAlign: 'left' }}>Customer & Destination</th>
                              <th style={{ minWidth: '120px', width: '15%', textAlign: 'center' }}>Delivery Date</th>
                              <th style={{ minWidth: '100px', width: '12%', textAlign: 'center' }}>Driver</th>
                              <th style={{ minWidth: '120px', width: '15%', textAlign: 'right' }}>Total Amount</th>
                              <th style={{ minWidth: '100px', width: '13%', textAlign: 'center' }}>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {completedCreatedDeliveries.map((delivery: any) => {
                              const productAmount = parseFloat(delivery.offeredAmount || '0');
                              const deliveryFee = parseFloat(delivery.finalDeliveryPrice || '0');
                              const totalAmount = productAmount + deliveryFee;

                              return (
                                <tr
                                  key={delivery.id}
                                  onClick={() => setViewingDelivery(delivery)}
                                  className={styles.clickableRow}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <td style={{ padding: '16px', textAlign: 'left' }}>
                                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>
                                      {delivery.products && delivery.products.length > 0 ? delivery.products.map((p: any) => {
                                        const variant = p.variantName ? ` - ${p.variantName}` : '';
                                        const unit = p.unit ? ` (${p.unit})` : '';
                                        return `${p.productName}${variant}${unit} × ${p.accumulatedQuantity || p.targetQuantity || 1}`;
                                      }).join(', ') : 'Custom Order'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                      Ref #{delivery.id}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'left' }}>
                                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>
                                      {delivery.customerName || 'Customer'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                      <MapPin size={12} style={{ flexShrink: 0 }} />
                                      <span style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={delivery.dropoffAddress}>
                                        {delivery.dropoffAddress || 'No Address'}
                                      </span>
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                                    {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : new Date(delivery.createdAt).toLocaleDateString()}
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', fontSize: '13px', color: '#475569', fontWeight: 600 }}>
                                    {delivery.partnerDriverName || 'Own Fleet'}
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '14px' }}>
                                      ₱{formatCurrency(totalAmount)}
                                    </div>
                                    {deliveryFee > 0 && (
                                      <div style={{ fontSize: '11px', color: '#64748b' }}>
                                        Fee: ₱{formatCurrency(deliveryFee)}
                                      </div>
                                    )}
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center' }}>
                                    <StatusBadge status={delivery.status} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'CREATED' && (
          <>
            <div className={styles.tableContainer} style={{ padding: '0 12px 12px' }}>
            <div className="table-responsive-wrapper">
            <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ minWidth: '180px', width: '25%', textAlign: 'left', paddingLeft: '16px' }}>Product Name</th>
                <th style={{ minWidth: '120px', width: '15%', textAlign: 'center' }}>Date</th>
                <th style={{ minWidth: '100px', width: '12%', textAlign: 'center' }}>Current Qty</th>
                <th style={{ minWidth: '100px', width: '12%', textAlign: 'center' }}>Quota</th>
                <th style={{ minWidth: '120px', width: '18%', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '90px', width: '18%', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody className={!loading ? styles.fadeIn : ''}>
              {loading ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px 24px 42px', textAlign: 'center' }}>
                      <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.2 }}>Loading deliveries...</div>
                    </td>
                  </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '0', border: 'none' }}>
                    <EmptyState
                      icon={Package}
                      title="No Deliveries Found"
                      description="You haven't created any deliveries yet."
                    />
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
                      {/* Product Name */}
                      <td style={{ minWidth: '180px', padding: '16px', textAlign: 'left', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 600, color: '#1e293b', lineHeight: 1.4, fontSize: '14px' }}>
                          {delivery.products && delivery.products.length > 0 ? delivery.products.map((p: any) => {
                            const variant = p.variantName ? ` - ${p.variantName}` : '';
                            const unit = p.unit ? ` (${p.unit})` : '';
                            return `${p.productName}${variant}${unit}`;
                          }).join(', ') : 'No Product'}
                        </div>
                      </td>

                      {/* Date */}
                      <td style={{ minWidth: '150px', padding: '16px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                          {delivery.deliveryDate ? new Date(delivery.deliveryDate).toLocaleDateString() : 'Not set'}
                        </div>
                      </td>
                      
                      {/* Current Qty */}
                      <td style={{ minWidth: '120px', padding: '16px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                          {delivery.products && delivery.products.length > 0 ? delivery.products.reduce((acc: number, p: any) => acc + (p.accumulatedQuantity || 0), 0) : 0}
                        </div>
                      </td>
                      
                      {/* Quota */}
                      <td style={{ minWidth: '120px', padding: '16px 8px', textAlign: 'center', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 500, color: '#475569', fontSize: '14px' }}>
                          {delivery.products && delivery.products.length > 0 ? delivery.products.reduce((acc: number, p: any) => acc + (p.targetQuantity || 0), 0) : 0}
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
                            { label: 'Mark Ready', icon: <CheckSquare size={14} />, onClick: () => readyMutation.mutate(delivery.id), color: '#eab308', disabled: isActing(delivery.id, 'mark ready') }
                          ] : []),
                          ...(delivery.status === 'READY_FOR_DISPATCH' ? [
                            { label: 'Dispatch', icon: <Truck size={14} />, onClick: () => handleDispatch(delivery.id), color: '#10b981', disabled: rowActing }
                          ] : []),
                          ...((['IN_TRANSIT', 'DISPATCHED'].includes(delivery.status) && delivery.internalAssignment && !delivery.temporaryWinnerId && !delivery.partnerDriverName) ? [
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
        <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(226, 232, 240, 0.5)', background: 'linear-gradient(180deg, rgba(248,250,252,0.8), rgba(255,255,255,0.95))', gap: '8px' }}>
          <button
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
            style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontWeight: 700, opacity: page === 1 ? 0.5 : 1, flexShrink: 0 }}
          >
            <ChevronLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569', padding: '6px 10px', borderRadius: '999px', background: '#f8fafc', border: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>Page {page} of {totalPages || 1}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '10px', background: 'white', cursor: page >= totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px', color: '#475569', fontWeight: 700, opacity: page >= totalPages ? 0.5 : 1, flexShrink: 0 }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
          </>
        )}
      </div>

      <DispatchModal
        isOpen={isDispatchModalOpen}
        onClose={() => { setIsDispatchModalOpen(false); setSelectedDeliveryId(null); }}
        deliveryId={selectedDeliveryId}
        tenantId={dispatchModalType === 'delivery' ? deliveries.find(d => d.id === selectedDeliveryId)?.tenantId : batches.find((b: any) => b.id === selectedDeliveryId)?.tenantId}
        type={dispatchModalType}
        onDispatchComplete={() => handleDispatchComplete(selectedDeliveryId ?? undefined)}
      />

      <DeliveryDetailsModal
        isOpen={!!viewingDelivery}
        onClose={() => setViewingDelivery(null)}
        delivery={viewingDelivery}
        onAddCustomer={handleOpenAddCustomer}
        onDispatch={() => {
          setViewingDelivery(null);
          handleDispatch(viewingDelivery.id);
        }}
      />

      <AddCustomerModal
        isOpen={!!addCustomerContext}
        onClose={() => setAddCustomerContext(null)}
        context={addCustomerContext}
        onSuccess={handleAddCustomerSuccess}
      />
      
      {/* Batch Customers Modal */}
      {selectedBatchForModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)' }} onClick={() => setSelectedBatchForModal(null)}></div>
          <div style={{ position: 'relative', width: '100%', maxWidth: '800px', maxHeight: '85vh', overflow: 'hidden', background: '#f8fafc', borderRadius: '24px', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', margin: '20px' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 32px', borderBottom: '1px solid #e2e8f0', background: 'white' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Customers in {selectedBatchForModal.productName}</h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px', fontWeight: 600 }}>{selectedBatchForModal.variantName} • {selectedBatchForModal.items.length} Customers</p>
              </div>
              <button onClick={() => setSelectedBatchForModal(null)} style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}>
                <XCircle size={20} />
              </button>
            </div>

            <div style={{ padding: '24px 32px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(() => {
                 const groupedItems = Object.values(
                   selectedBatchForModal.items.reduce((acc: any, item: any) => {
                     const key = item.customerName;
                     if (!acc[key]) {
                       acc[key] = {
                         ...item, // keep the first item's details (address, contact, priority)
                         totalQuantity: 0,
                         totalAmount: 0
                       };
                     }
                     const qty = Number(item.quantity) || 0;
                     const amount = qty * (selectedBatchForModal.variantPrice || 0);
                     acc[key].totalQuantity += qty;
                     acc[key].totalAmount += amount;
                     
                     // Keep URGENT priority if any item is urgent
                     if (item.deliveryPriority === 'URGENT') {
                       acc[key].deliveryPriority = 'URGENT';
                       acc[key].deliveryDate = item.deliveryDate || acc[key].deliveryDate;
                     }
                     
                     return acc;
                   }, {})
                 );

                 return groupedItems.map((item: any) => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <MapPin size={20} color="#64748b" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <div style={{ fontWeight: 800, color: '#1e293b', fontSize: '16px' }}>{item.customerName}</div>
                            {item.deliveryPriority === 'URGENT' && (
                              <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>URGENT</span>
                            )}
                          </div>
                          
                          <div style={{ fontSize: '14px', color: '#475569', marginBottom: '8px', lineHeight: 1.5, maxWidth: '450px' }}>{item.dropoffAddress}</div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                            {item.customerContact && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 600, background: '#f8fafc', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <Phone size={14} /> {item.customerContact}
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#4f46e5', fontWeight: 600, background: '#eef2ff', padding: '4px 10px', borderRadius: '8px', border: '1px solid #e0e7ff' }}>
                              <Package size={14} /> {item.totalQuantity} units
                            </div>
                            {item.deliveryPriority === 'URGENT' && item.deliveryDate && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', fontWeight: 600, background: '#fef2f2', padding: '4px 10px', borderRadius: '8px', border: '1px solid #fecaca' }}>
                                <Calendar size={14} /> {new Date(item.deliveryDate).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Price</div>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '18px' }}>
                          ₱{formatCurrency(item.totalAmount)}
                        </span>
                      </div>
                    </div>
                 ));
              })()}
            </div>
          </div>
        </div>
      )}

      <CreateDeliveryModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['deliveries'] })}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  let color = '#475569', bg = '#f1f5f9';
  let Icon: any = Clock;
  let displayStatus = status.replace(/_/g, ' ');

  if (status === 'READY_FOR_DISPATCH') { color = '#d97706'; bg = '#fef3c7'; Icon = Clock; displayStatus = 'READY FOR DISPATCH'; }
  else if (status === 'DRAFT') { color = '#64748b'; bg = '#f1f5f9'; Icon = Edit; }
  else if (status === 'WAITING_FOR_PARTNER') { color = '#d97706'; bg = '#fef3c7'; Icon = Clock; displayStatus = 'WAITING FOR PARTNER'; }
  else if (status === 'ACCEPTED') { color = '#2563eb'; bg = '#dbeafe'; Icon = Truck; displayStatus = 'ACCEPTED'; }
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
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

