'use client';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Clock, ShoppingBag, MapPin, Package, X, ChevronDown, ChevronUp, AlertCircle, Calendar, Zap, Trash2, Phone, Truck, Edit2 } from 'lucide-react';
import styles from '../admin.module.css';
import { ActionMenu } from '@/components/ActionMenu';
import { EmptyState } from '@/components/EmptyState';
import dynamic from 'next/dynamic';

const DispatchModal = dynamic(() => import('../deliveries/DispatchModal').then(m => m.DispatchModal), {
  ssr: false
});


interface CustomerOrder {
  id: number;
  customerName: string;
  customerContact?: string | null;
  dropoffAddress: string;
  status: string;
  orderSource: string;
  batchId?: number | null;
  deliveryPriority: string;
  urgentReason?: string | null;
  normalDeliveryFee?: string | number | null;
  urgentAdditionalFee?: string | number | null;
  createdAt: string | Date;
  deliveryDate?: string | Date | null;
  products: OrderProduct[];
  instructions?: string | null;
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface OrderProduct {
  itemId: number;
  deliveryOrderId: number;
  productId: number;
  variantId?: number;
  variantName?: string | null;
  productName: string;
  quantity: number;
  unitPrice: string | number;
  unit?: string | null;
  quota?: number;
  equivalentQty?: number;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; type: 'success' | 'error' };
let toastId = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, show };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCurrency(val: string | number) {
  const n = Number(val);
  if (!Number.isFinite(n)) return '0.00';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Pending', color: '#d97706', bg: '#fef3c7' },
    WAITING: { label: 'Waiting', color: '#d97706', bg: '#fef3c7' },
    PROCESSING: { label: 'Accepted', color: '#2563eb', bg: '#dbeafe' },
    COMPLETED: { label: 'Completed', color: '#16a34a', bg: '#dcfce7' },
    CANCELLED: { label: 'Rejected', color: '#ef4444', bg: '#fee2e2' },
  };
  const s = map[status] || { label: status, color: '#475569', bg: '#f1f5f9' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', backgroundColor: s.bg, color: s.color, borderRadius: '999px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

// ── Order Details Modal ───────────────────────────────────────────────────────
function OrderDetailsModal({ isOpen, onClose, order, onDispatch, isDispatching, onDelete, isDeleting }: { isOpen: boolean; onClose: () => void; order: CustomerOrder | null; onDispatch?: (id: number) => void; isDispatching?: boolean; onDelete?: (id: number) => void; isDeleting?: boolean }) {
  if (!isOpen || !order) return null;

  const isUrgent = order.deliveryPriority === 'URGENT';
  const subtotal = order.products.reduce((sum, p) => sum + Number(p.unitPrice || 0) * p.quantity, 0);
  const deliveryFee = Number(order.normalDeliveryFee || 0) + (isUrgent ? Number(order.urgentAdditionalFee || 0) : 0);
  const total = subtotal + deliveryFee;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '20px' }}>
      <div className={styles.fadeIn} style={{ backgroundColor: 'white', borderRadius: '24px', width: '100%', maxWidth: '900px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
        {/* Header */}
        <div style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Order Details</h2>
              {isUrgent && (
                <span style={{ backgroundColor: '#fef2f2', color: '#dc2626', fontSize: '12px', fontWeight: 800, padding: '4px 8px', borderRadius: '6px', border: '1px solid #fee2e2' }}>URGENT: {order.urgentReason || 'No reason provided'}</span>
              )}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#64748b', marginTop: '4px' }}>Ref: {order.id}</div>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {order.orderSource === 'MARKETPLACE' && !order.batchId && onDispatch && (
              <button
                onClick={() => onDispatch(order.id)}
                disabled={isDispatching}
                style={{ background: '#4f46e5', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: isDispatching ? 'not-allowed' : 'pointer', opacity: isDispatching ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Package size={16} />
                {isDispatching ? 'Dispatching...' : 'Dispatch Now'}
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete this order?')) {
                    onDelete(order.id);
                  }
                }}
                disabled={isDeleting}
                style={{ background: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={16} />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            <button onClick={onClose} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', transition: 'all 0.2s' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
          {/* Left Column */}
          <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', marginTop: 0 }}>Customer & Route</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Customer Name</div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{order.customerName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Contact</div>
                  <div style={{ fontWeight: 600, color: '#1e293b' }}>{order.customerContact || 'N/A'}</div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>Drop-off Address</div>
                  <div style={{ fontWeight: 600, color: '#1e293b', display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                    <MapPin size={16} color="#4f46e5" style={{ flexShrink: 0, marginTop: '2px' }} />
                    {order.dropoffAddress}
                  </div>
                  {order.instructions && (
                    <div style={{ marginTop: '8px', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '6px', padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 700, color: '#a16207', fontSize: '12px', whiteSpace: 'nowrap' }}>Landmark:</span>
                      <span style={{ color: '#854d0e', fontSize: '13px', lineHeight: 1.4 }}>{order.instructions}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', marginTop: 0 }}>Items Ordered</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {order.products.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '40px', height: '40px', background: '#eff6ff', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Package size={20} color="#4f46e5" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                          {p.productName}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
                          Qty: {p.quantity} {p.unit ? `(${p.unit})` : ''} &times; {formatCurrency(p.unitPrice)}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '15px' }}>
                      {formatCurrency(Number(p.unitPrice || 0) * p.quantity)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (Summary) */}
          <div style={{ flex: 1, background: '#f8fafc', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', marginTop: 0 }}>Order Summary</h3>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
              <span>Subtotal</span>
              <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#475569' }}>
              <span>Delivery Fee</span>
              <span style={{ fontWeight: 600 }}>
                {(order.orderSource === 'MARKETPLACE' && !order.batchId) ? 'TBD' : (order.normalDeliveryFee ? formatCurrency(order.normalDeliveryFee) : 'TBD')}
              </span>
            </div>

            {isUrgent && order.urgentAdditionalFee && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '14px', color: '#dc2626' }}>
                <span>Urgent Surcharge</span>
                <span style={{ fontWeight: 600 }}>+{formatCurrency(order.urgentAdditionalFee)}</span>
              </div>
            )}

            <div style={{ borderTop: '2px dashed #cbd5e1', margin: '16px 0', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '16px' }}>Total Amount</span>
              <span style={{ fontWeight: 800, color: '#4f46e5', fontSize: '20px' }}>
                {(order.orderSource === 'MARKETPLACE' && !order.batchId) 
                  ? `${formatCurrency(subtotal + (isUrgent ? Number(order.urgentAdditionalFee || 0) : 0))} + TBD` 
                  : (order.normalDeliveryFee ? formatCurrency(total) : `${formatCurrency(subtotal + (isUrgent ? Number(order.urgentAdditionalFee || 0) : 0))} + TBD`)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Main Component ─────────────────────────────────────────────────────────────
export default function OrdersClient({ initialOrders }: { initialOrders: CustomerOrder[] }) {
  const queryClient = useQueryClient();
  const { toasts, show: showToast } = useToast();
  const [actingId, setActingId] = useState<{ id: number; action: 'accept' | 'reject' | 'dispatch' | 'delete' } | null>(null);

  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null);
  const [newBatchPrompt, setNewBatchPrompt] = useState<{ isOpen: boolean, orderIds: number[], defaultBatchName: string, basisVariantId: number | null }>({ isOpen: false, orderIds: [], defaultBatchName: '', basisVariantId: null });
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewingOrder, setViewingOrder] = useState<CustomerOrder | null>(null);
  const [dispatchModalBatchId, setDispatchModalBatchId] = useState<number | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Record<number, boolean>>({});
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupNameOverrides, setGroupNameOverrides] = useState<Record<string, string>>({});
  const [dragOverBatchId, setDragOverBatchId] = useState<number | null>(null);
  const [dragOverGroupName, setDragOverGroupName] = useState<string | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [batchNameOverrides, setBatchNameOverrides] = useState<Record<number, string>>({});

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev => ({
      ...prev,
      [orderId]: !prev[orderId]
    }));
  };

  const toggleGroupSelection = (orderIds: number[], forceState: boolean) => {
    setSelectedOrders(prev => {
      const next = { ...prev };
      orderIds.forEach(id => {
        next[id] = forceState;
      });
      return next;
    });
  };

  const { data: orders, isLoading: loading } = useQuery<CustomerOrder[]>({
    queryKey: ['admin-orders'],
    queryFn: async () => {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch orders');
      const json = await res.json();
      return json.data;
    },
    initialData: initialOrders,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/orders/${id}/accept`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to accept');
      return data;
    },
    onMutate: (id) => setActingId({ id, action: 'accept' }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CustomerOrder[]>(['admin-orders'], prev =>
        prev ? prev.map(o => o.id === id ? { ...o, status: 'PROCESSING' } : o) : prev
      );
      showToast('Order accepted! Preparing for fulfillment.', 'success');
    },
    onError: (err: any) => showToast(err.message || 'Failed to accept order', 'error'),
    onSettled: () => setActingId(null),
  });

  const dispatchMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/orders/${id}/dispatch`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch');
      return data;
    },
    onMutate: (id) => setActingId({ id, action: 'dispatch' }),
    onSuccess: (data, id) => {
      queryClient.setQueryData<CustomerOrder[]>(['admin-orders'], prev =>
        prev ? prev.map(o => o.id === id ? { ...o, status: 'PROCESSING' } : o) : prev
      );
      showToast('Order batched successfully!', 'success');
      setViewingOrder(null);
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });

      if (data.batchIds && data.batchIds.length > 0) {
        setDispatchModalBatchId(data.batchIds[0]);
      }
    },
    onError: (err: any) => showToast(err.message || 'Failed to dispatch order', 'error'),
    onSettled: () => setActingId(null),
  });

  const [isBatchDispatching, setIsBatchDispatching] = useState(false);

  const batchDispatchMutation = useMutation({
    mutationFn: async ({ orderIds, batchName, basisVariantId }: { orderIds: number[], batchName?: string, basisVariantId?: number }) => {
      const res = await fetch(`/api/admin/orders/batch-dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ orderIds, batchName, basisVariantId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch batch');
      return data;
    },
    onMutate: () => setIsBatchDispatching(true),
    onSuccess: (data, { orderIds }) => {
      queryClient.setQueryData<CustomerOrder[]>(['admin-orders'], prev =>
        prev ? prev.map(o => orderIds.includes(o.id) ? { ...o, status: 'PROCESSING' } : o) : prev
      );
      showToast('Selected orders batched successfully!', 'success');

      setSelectedOrders(prev => {
        const next = { ...prev };
        orderIds.forEach(id => delete next[id]);
        return next;
      });

      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-batches'] });
      
      if (data.batchIds && data.batchIds.length > 0) {
        setDispatchModalBatchId(data.batchIds[0]);
      }
    },
    onError: (err: any) => showToast(err.message || 'Failed to dispatch orders', 'error'),
    onSettled: () => setIsBatchDispatching(false),
  });

  const addToBatchMutation = useMutation({
    mutationFn: async ({ orderIds, targetBatchId }: { orderIds: number[], targetBatchId: number }) => {
      const res = await fetch(`/api/admin/orders/add-to-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ orderIds, targetBatchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add to batch');
      return data;
    },
    onSuccess: () => {
      showToast('Customers added to batch successfully!', 'success');
      setSelectedOrders({});
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-batches'] });
    },
    onError: (err: any) => showToast(err.message || 'Failed to add to batch', 'error'),
  });

  const { data: batches = [] } = useQuery({
    queryKey: ['marketplace-batches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deliveries/marketplace', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch marketplace batches');
      const allBatches = await res.json();
      return allBatches.filter((b: any) => b.status === 'DRAFT' || b.status === 'READY_FOR_DELIVERY');
    },
    refetchInterval: 30_000,
  });

  const removeFromBatchMutation = useMutation({
    mutationFn: async ({ batchItemId, orderId, batchId }: { batchItemId: number, orderId: number, batchId: number }) => {
      // We can just call an API endpoint to remove the item from the batch.
      // But wait! Do we have this endpoint? The user earlier said "when i drag it says internal server and remove number 2"
      // They probably mean "tell here that removing will deduct the quota etc"
      // Wait, there is no remove endpoint yet? Let's check!
      const res = await fetch(`/api/admin/orders/${orderId}/remove-from-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ batchItemId, batchId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove from batch');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-batches'] });
      showToast('Order removed from batch.', 'success');
    },
    onError: (err: any) => showToast(err.message || 'Failed to remove from batch', 'error'),
  });

  const renameBatchMutation = useMutation({
    mutationFn: async ({ batchId, batchName }: { batchId: number, batchName: string }) => {
      const res = await fetch(`/api/admin/deliveries/batches/${batchId}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ batchName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to rename batch');
      return data;
    },
    onSuccess: () => {
      showToast('Batch renamed successfully.', 'success');
      queryClient.invalidateQueries({ queryKey: ['marketplace-batches'] });
    },
    onError: (err: any) => showToast(err.message || 'Failed to rename batch', 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/orders/${id}/reject`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reject');
      return data;
    },
    onMutate: (id) => setActingId({ id, action: 'reject' }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CustomerOrder[]>(['admin-orders'], prev =>
        prev ? prev.map(o => o.id === id ? { ...o, status: 'CANCELLED' } : o) : prev
      );
      showToast('Order rejected.', 'success');
    },
    onError: (err: any) => showToast(err.message || 'Failed to reject order', 'error'),
    onSettled: () => setActingId(null),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      return data;
    },
    onMutate: (id) => setActingId({ id, action: 'delete' }),
    onSuccess: (_, id) => {
      queryClient.setQueryData<CustomerOrder[]>(['admin-orders'], prev =>
        prev ? prev.filter(o => o.id !== id) : prev
      );
      showToast('Order deleted successfully.', 'success');
      setViewingOrder(null);
    },
    onError: (err: any) => showToast(err.message || 'Failed to delete order', 'error'),
    onSettled: () => setActingId(null),
  });

  const statuses = ['ALL'];
  const labelMap: Record<string, string> = {
    ALL: 'All',
    DRAFT: 'Pending',
    PROCESSING: 'Accepted',
    COMPLETED: 'Completed',
    CANCELLED: 'Rejected',
  };

  const filtered = (orders || []).filter(o => (filterStatus === 'ALL' ? o.status !== 'CANCELLED' : o.status === filterStatus));
  const pendingCount = (orders || []).filter(o => o.status === 'DRAFT').length;

  // Separate orders
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (groupName: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const manualFiltered = filtered.filter(o => o.orderSource !== 'MARKETPLACE');
  const marketplaceFiltered = filtered.filter(o => o.orderSource === 'MARKETPLACE' && !o.batchId);

  // Group marketplace orders by product
  interface ProductGroup {
    productName: string;
    totalCustomers: number;
    totalQuantity: number;
    totalValue: number;
    urgentCount: number;
    quota: number;
    orders: CustomerOrder[];
  }

  const marketplaceGroups: Record<string, ProductGroup> = {};
  for (const o of marketplaceFiltered) {
    if (!o.products || o.products.length === 0) continue;

    // Use the primary product (first one) as the group to avoid splitting a single order
    const p = o.products[0];
    const unitSuffix = p.unit && !['piece', 'pcs', 'piece (s)', 'pieces'].includes(p.unit.toLowerCase()) ? ` - ${p.unit}` : '';
    const key = p.productName + unitSuffix;

    if (!marketplaceGroups[key]) {
      marketplaceGroups[key] = {
        productName: key,
        totalCustomers: 0,
        totalQuantity: 0,
        totalValue: 0,
        urgentCount: 0,
        quota: p.quota || 50,
        orders: []
      };
    }

    marketplaceGroups[key].orders.push(o);
    marketplaceGroups[key].totalCustomers++;
    if (o.deliveryPriority === 'URGENT') {
      marketplaceGroups[key].urgentCount++;
    }

    // Sum up the quantities and values of all products in this single order
    let orderQty = 0;
    let orderValue = 0;
    for (const prod of o.products) {
      const eqQty = prod.equivalentQty ? Number(prod.equivalentQty) : 1;
      orderQty += prod.quantity * eqQty;
      orderValue += (Number(prod.unitPrice || 0) * prod.quantity);
    }

    marketplaceGroups[key].totalQuantity += orderQty;
    marketplaceGroups[key].totalValue += orderValue;
  }

  // Sort orders within each group so URGENT is at the top
  const sortedMarketplaceGroups = Object.values(marketplaceGroups).map(g => {
    g.orders.sort((a, b) => {
      if (a.deliveryPriority === 'URGENT' && b.deliveryPriority !== 'URGENT') return -1;
      if (b.deliveryPriority === 'URGENT' && a.deliveryPriority !== 'URGENT') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return g;
  });

  const isActing = (id: number, action?: string) =>
    actingId?.id === id && (!action || actingId.action === action);

  return (
    <div style={{ padding: '0', maxWidth: '100%', margin: '0 auto', position: 'relative' }}>
      {/* Toast */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: t.type === 'error' ? '#fef2f2' : '#ecfdf5', color: t.type === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${t.type === 'error' ? '#fecaca' : '#bbf7d0'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', maxWidth: '360px', pointerEvents: 'auto' }}>
            {t.message}
          </div>
        ))}
      </div>

      <OrderDetailsModal
        isOpen={!!viewingOrder}
        onClose={() => setViewingOrder(null)}
        order={viewingOrder}
        onDispatch={(id) => dispatchMutation.mutate(id)}
        isDispatching={actingId?.id === viewingOrder?.id && actingId?.action === 'dispatch'}
        onDelete={(id) => deleteMutation.mutate(id)}
        isDeleting={actingId?.id === viewingOrder?.id && actingId?.action === 'delete'}
      />

      <DispatchModal
        isOpen={dispatchModalBatchId !== null}
        onClose={() => setDispatchModalBatchId(null)}
        deliveryId={dispatchModalBatchId}
        type="batch"
        onDispatchComplete={() => {
          showToast('Batch broadcasted successfully!', 'success');
          window.location.href = '/admin/deliveries';
        }}
      />

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


        {/* MARKETPLACE SECTION (Waiting for Quota) */}
        {marketplaceFiltered.length === 0 && batches.length === 0 ? (
          <EmptyState
            icon={Package}
            title="NO ORDERS WAITING"
            description="There are currently no marketplace orders waiting for quota."
          />
        ) : (
          <div style={{ padding: '0 12px 0' }}>
            <div style={{ padding: '24px 12px 12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#334155', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="#d97706" /> Waiting for Quota
              </h3>
              <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>
                Marketplace orders waiting to be batched into deliveries.
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 12px 24px' }}>
              {sortedMarketplaceGroups.map(group => {
                const isExpanded = expandedGroups[group.productName];
                const hasUrgent = group.urgentCount > 0;
                const percentage = Math.min(100, Math.round((group.totalQuantity / group.quota) * 100));

                return (
                  <div key={group.productName}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverGroupName !== group.productName) setDragOverGroupName(group.productName);
                    }}
                    onDragLeave={() => {
                      if (dragOverGroupName === group.productName) setDragOverGroupName(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverGroupName(null);
                      const oIdsStr = e.dataTransfer.getData('orderIds');
                      const oId = e.dataTransfer.getData('orderId');

                      let draggedOrderIds: number[] = [];
                      if (oIdsStr) {
                        try { draggedOrderIds = JSON.parse(oIdsStr); } catch (err) { }
                      }
                      if (draggedOrderIds.length === 0 && oId) {
                        draggedOrderIds = [Number(oId)];
                      }

                      if (draggedOrderIds.length > 0) {
                        const existingGroupOrderIds = group.orders.map(o => o.id);
                        const combinedOrderIds = Array.from(new Set([...draggedOrderIds, ...existingGroupOrderIds]));

                        // Automatically create batch without popup as requested by the user for non-"Create New Batch" areas
                        batchDispatchMutation.mutate({
                          orderIds: combinedOrderIds,
                          batchName: groupNameOverrides[group.productName] || group.productName,
                          basisVariantId: undefined
                        });
                      }
                    }}
                    style={{
                      background: dragOverGroupName === group.productName ? '#eff6ff' : '#fff',
                      borderRadius: '16px',
                      border: dragOverGroupName === group.productName ? '2px dashed #3b82f6' : (hasUrgent ? '1px solid #fca5a5' : '1px solid #e2e8f0'),
                      boxShadow: hasUrgent ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}>
                    {/* Header Summary */}
                    <div
                      onClick={() => toggleGroup(group.productName)}
                      style={{
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: hasUrgent ? '#fef2f2' : '#f8fafc',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {editingGroup === group.productName ? (
                            <input
                              autoFocus
                              type="text"
                              defaultValue={groupNameOverrides[group.productName] || group.productName}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                setGroupNameOverrides(prev => ({ ...prev, [group.productName]: e.target.value }));
                                setEditingGroup(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setGroupNameOverrides(prev => ({ ...prev, [group.productName]: e.currentTarget.value }));
                                  setEditingGroup(null);
                                }
                              }}
                              style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', border: '1px solid #3b82f6', borderRadius: '4px', padding: '2px 8px', outline: 'none' }}
                            />
                          ) : (
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {groupNameOverrides[group.productName] || group.productName}
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingGroup(group.productName); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
                                title="Rename group"
                              >
                                <Edit2 size={14} />
                              </button>
                            </h4>
                          )}
                          {hasUrgent && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                              <Zap size={12} fill="white" /> URGENT ×{group.urgentCount}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span>{group.totalCustomers} Customers</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>{group.totalQuantity} Ordered</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>Quota: {group.quota}</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>{formatCurrency(group.totalValue)}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Quota Progress</div>
                          <div style={{ width: '120px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percentage}%`, background: percentage >= 100 ? '#10b981' : '#3b82f6', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Content (Orders List) */}
                    {isExpanded && (
                      <div style={{ padding: '0', display: 'flex', flexDirection: 'column' }} className={styles.fadeIn}>
                        <table className={styles.table} style={{ margin: 0, width: '100%' }}>
                          <thead style={{ background: '#f1f5f9' }}>
                            <tr>

                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px' }}>Customer</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px' }}>Items</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Quantity</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.orders.map(order => {
                              const p = order.products.find(prod => prod.productName === group.productName) || order.products[0];
                              const isOrderUrgent = order.deliveryPriority === 'URGENT';
                              const rowActing = actingId?.id === order.id;
                              const isDeleting = actingId?.id === order.id && actingId?.action === 'delete';

                              return (
                                <tr
                                  key={order.id}
                                  draggable
                                  onDragStart={(e) => {
                                    const selectedIdsAll = Object.keys(selectedOrders).filter(id => selectedOrders[Number(id)]).map(Number);
                                    let idsToDrag = [order.id];
                                    if (selectedOrders[order.id] && selectedIdsAll.length > 1) {
                                      idsToDrag = selectedIdsAll;
                                    }
                                    e.dataTransfer.setData('orderIds', JSON.stringify(idsToDrag));
                                    e.dataTransfer.setData('orderId', order.id.toString());
                                    e.dataTransfer.setData('variantId', p?.productId?.toString() || '');
                                    e.dataTransfer.setData('variantName', groupNameOverrides[group.productName] || group.productName);
                                    setDraggedOrderId(order.id);
                                  }}
                                  onDragEnd={() => setDraggedOrderId(null)}
                                  style={{
                                    background: isOrderUrgent ? '#fff5f5' : 'white',
                                    opacity: rowActing || draggedOrderId === order.id ? 0.5 : 1,
                                    borderBottom: '1px solid #f1f5f9',
                                    cursor: 'grab'
                                  }}
                                  className={styles.clickableRow}
                                >

                                  <td style={{ padding: '16px', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setViewingOrder(order)}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {order.customerName}
                                        {isOrderUrgent && (
                                          <span style={{ background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>URGENT</span>
                                        )}
                                      </div>
                                      {isOrderUrgent && order.deliveryDate && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>
                                          <Calendar size={12} /> {new Date(order.deliveryDate).toLocaleDateString()}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setViewingOrder(order)}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      {Object.values((order.products || []).reduce((acc: any, prod: any) => {
                                        const unitSuffix = prod.unit ? `(${prod.unit}) ` : '';
                                        const variantStr = prod.variantName ? ` - ${prod.variantName}` : '';
                                        const key = prod.productName + variantStr + unitSuffix;
                                        if (!acc[key]) acc[key] = { ...prod, unitSuffix, variantStr };
                                        else acc[key].quantity += prod.quantity;
                                        return acc;
                                      }, {})).map((prod: any) => (
                                        <div key={prod.itemId} style={{ fontSize: '12px', color: '#475569', marginBottom: '2px' }}>
                                          {prod.productName}{prod.variantStr} {prod.unitSuffix}x{prod.quantity}
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setViewingOrder(order)}>
                                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px' }}>
                                      {order.products.reduce((acc, prod) => acc + (prod.quantity * (prod.equivalentQty ? Number(prod.equivalentQty) : 1)), 0)}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setViewingOrder(order)}>
                                    <div style={{ fontWeight: 600, color: '#475569', fontSize: '14px' }}>
                                      {formatCurrency(order.products.reduce((acc, prod) => acc + (Number(prod.unitPrice || 0) * prod.quantity), 0))}
                                    </div>
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }} onClick={() => setViewingOrder(order)}>
                                    <StatusBadge status="WAITING" />
                                  </td>
                                  <td style={{ padding: '16px', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this order?')) {
                                          deleteMutation.mutate(order.id);
                                        }
                                      }}
                                      disabled={isDeleting}
                                      style={{
                                        background: 'transparent',
                                        color: '#dc2626',
                                        border: 'none',
                                        padding: '8px',
                                        borderRadius: '8px',
                                        cursor: isDeleting ? 'not-allowed' : 'pointer',
                                        opacity: isDeleting ? 0.5 : 1,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'background 0.2s'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                      title="Delete Order"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Footer Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <button
                            disabled={isBatchDispatching}
                            onClick={() => {
                              const orderIds = group.orders.map((o: any) => o.id);
                              if (orderIds.length > 0) {
                                batchDispatchMutation.mutate({ orderIds, batchName: groupNameOverrides[group.productName] || group.productName, basisVariantId: group.orders[0]?.products?.[0]?.variantId });
                              }
                            }}
                            style={{
                              padding: '8px 16px',
                              borderRadius: '8px',
                              background: '#3b82f6',
                              color: 'white',
                              fontWeight: 600,
                              fontSize: '13px',
                              cursor: 'pointer',
                              border: 'none',
                              opacity: isBatchDispatching ? 0.7 : 1
                            }}
                          >
                            Dispatch Delivery
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {batches.map((batch: any) => {
                const isExpanded = expandedGroups[batch.batchNumber];
                const totalCustomers = new Set((batch.items || []).map((it: any) => it.customerName)).size;
                const urgentCount = batch.items?.filter((it: any) => it.deliveryPriority === 'URGENT').length || 0;
                const hasUrgent = urgentCount > 0;
                const percentage = batch.quotaQuantity ? Math.min(100, Math.round((batch.totalQuantity / batch.quotaQuantity) * 100)) : 100;

                return (
                  <div key={batch.id}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverBatchId !== batch.id) setDragOverBatchId(batch.id);
                    }}
                    onDragLeave={() => {
                      if (dragOverBatchId === batch.id) setDragOverBatchId(null);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOverBatchId(null);
                      const oIdsStr = e.dataTransfer.getData('orderIds');
                      const oId = e.dataTransfer.getData('orderId');

                      let orderIds: number[] = [];
                      if (oIdsStr) {
                        try {
                          orderIds = JSON.parse(oIdsStr);
                        } catch (err) { }
                      }
                      if (orderIds.length === 0 && oId) {
                        orderIds = [Number(oId)];
                      }
                      if (orderIds.length > 0) {
                        addToBatchMutation.mutate({ orderIds, targetBatchId: batch.id });
                      }
                    }}
                    style={{
                      background: dragOverBatchId === batch.id ? '#eff6ff' : '#fff',
                      borderRadius: '16px',
                      border: dragOverBatchId === batch.id ? '2px dashed #3b82f6' : (hasUrgent ? '1px solid #fca5a5' : '1px solid #e2e8f0'),
                      boxShadow: hasUrgent ? '0 4px 12px rgba(239, 68, 68, 0.1)' : '0 2px 8px rgba(15, 23, 42, 0.04)',
                      overflow: 'hidden',
                      transition: 'all 0.2s'
                    }}>
                    {/* Header Summary */}
                    <div
                      onClick={() => toggleGroup(batch.batchNumber)}
                      style={{
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        background: hasUrgent ? '#fef2f2' : '#f8fafc',
                        borderBottom: isExpanded ? '1px solid #e2e8f0' : 'none',
                        transition: 'background 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {editingBatchId === batch.id ? (
                            <input
                              autoFocus
                              type="text"
                              defaultValue={batchNameOverrides[batch.id] || batch.batchNumber}
                              onClick={(e) => e.stopPropagation()}
                              onBlur={(e) => {
                                const newName = e.target.value.trim();
                                if (newName && newName !== batch.batchNumber) {
                                  renameBatchMutation.mutate({ batchId: batch.id, batchName: newName });
                                }
                                setEditingBatchId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const newName = e.currentTarget.value.trim();
                                  if (newName && newName !== batch.batchNumber) {
                                    renameBatchMutation.mutate({ batchId: batch.id, batchName: newName });
                                  }
                                  setEditingBatchId(null);
                                }
                              }}
                              style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', border: '1px solid #3b82f6', borderRadius: '4px', padding: '2px 8px', outline: 'none' }}
                            />
                          ) : (
                            <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {batch.batchNumber && !batch.batchNumber.startsWith('DEL-')
                                ? batch.batchNumber
                                : (batch.productName ? `${batch.productName} - ${batch.variantName}` : (batch.variantName || 'Batch ' + batch.batchNumber))}
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingBatchId(batch.id); setBatchNameOverrides(prev => ({...prev, [batch.id]: batch.batchNumber})); }}
                                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center', padding: '4px' }}
                                title="Rename batch"
                              >
                                <Edit2 size={14} />
                              </button>
                            </h4>
                          )}
                          {hasUrgent && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                              <Zap size={12} fill="white" /> URGENT ×{urgentCount}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span>{totalCustomers} Customers</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>{batch.totalQuantity} Ordered</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span>Quota: {batch.quotaQuantity}</span>
                          <span style={{ color: '#cbd5e1' }}>•</span>
                          <span style={{ fontWeight: 600, color: '#16a34a' }}>
                            {formatCurrency(batch.items?.reduce((sum: number, it: any) => sum + (Number(it.offeredAmount || 0) + Number(it.finalDeliveryPrice || 0)), 0) || 0)}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Quota Progress</div>
                          <div style={{ width: '120px', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${percentage}%`, background: percentage >= 100 ? '#10b981' : '#3b82f6', transition: 'width 0.3s ease' }}></div>
                          </div>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', border: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ padding: '0', display: 'flex', flexDirection: 'column' }} className={styles.fadeIn}>
                        <table className={styles.table} style={{ margin: 0, width: '100%' }}>
                          <thead style={{ background: '#f1f5f9' }}>
                            <tr>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px' }}>Customer</th>
                              <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '12px' }}>Items Included</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Quantity</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Amount</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Status</th>
                              <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: '12px' }}>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const grouped = Object.values(
                                (batch.items || []).reduce((acc: any, it: any) => {
                                  const key = it.customerName;
                                  if (!acc[key]) {
                                    acc[key] = {
                                      id: it.id,
                                      customerName: it.customerName,
                                      customerContact: it.customerContact,
                                      deliveryPriority: it.deliveryPriority,
                                      status: it.status,
                                      customerOrderIds: [],
                                      quantity: 0,
                                      amount: 0,
                                      products: [],
                                      rawItems: []
                                    };
                                  }
                                  acc[key].customerOrderIds.push(it.customerOrderId);
                                  acc[key].quantity += Number(it.quantity || 0);
                                  acc[key].amount += (it.products || []).reduce((sum: number, curr: any) => sum + (Number(curr.unitPrice) * curr.quantity), 0);
                                  if (it.products) acc[key].products.push(...it.products);
                                  acc[key].rawItems.push(it);
                                  if (it.deliveryPriority === 'URGENT') acc[key].deliveryPriority = 'URGENT';
                                  return acc;
                                }, {})
                              );

                              return grouped.map((it: any) => {
                                const p = (it.products || [])[0] || {};
                                const isOrderUrgent = it.deliveryPriority === 'URGENT';
                                return (
                                  <tr
                                    key={it.id}
                                    className={styles.clickableRow}
                                    draggable
                                    onDragStart={(e) => {
                                      const selectedIdsAll = Object.keys(selectedOrders).filter(id => selectedOrders[Number(id)]).map(Number);
                                      let idsToDrag = it.customerOrderIds;
                                      if (it.customerOrderIds.some((id: number) => selectedOrders[id]) && selectedIdsAll.length > 1) {
                                        idsToDrag = selectedIdsAll;
                                      }
                                      e.dataTransfer.setData('orderIds', JSON.stringify(idsToDrag));
                                      e.dataTransfer.setData('orderId', it.customerOrderIds[0].toString());
                                      e.dataTransfer.setData('variantId', p?.productId?.toString() || '');
                                      e.dataTransfer.setData('variantName', batch.variantName || 'Batch');
                                      setDraggedOrderId(it.customerOrderIds[0]);
                                    }}
                                    onDragEnd={() => setDraggedOrderId(null)}
                                    style={{
                                      background: isOrderUrgent ? '#fff5f5' : 'white',
                                      opacity: draggedOrderId && it.customerOrderIds.includes(draggedOrderId) ? 0.5 : 1,
                                      borderBottom: '1px solid #f1f5f9',
                                      cursor: 'grab'
                                    }}
                                  >
                                    <td
                                      style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', cursor: 'pointer' }}
                                      onClick={() => {
                                        const actualOrder = orders?.find(o => o.id === it.customerOrderIds[0]);
                                        if (actualOrder) setViewingOrder(actualOrder);
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '13px' }}>{it.customerName}</div>
                                      {it.deliveryPriority === 'URGENT' && (
                                        <span style={{ display: 'inline-block', marginTop: '4px', background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', padding: '2px 6px', borderRadius: '6px', fontSize: '10px', fontWeight: 800 }}>URGENT</span>
                                      )}
                                    </td>
                                    <td
                                      style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', verticalAlign: 'middle', cursor: 'pointer' }}
                                      onClick={() => {
                                        const actualOrder = orders?.find(o => o.id === it.customerOrderIds[0]);
                                        if (actualOrder) setViewingOrder(actualOrder);
                                      }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {Object.values((it.products || []).reduce((acc: any, p: any) => {
                                          const unitSuffix = p.unit ? `(${p.unit}) ` : '';
                                          const variantStr = p.variantName ? ` - ${p.variantName}` : '';
                                          const key = p.productName + variantStr + unitSuffix;
                                          if (!acc[key]) acc[key] = { ...p, unitSuffix, variantStr };
                                          else acc[key].quantity += p.quantity;
                                          return acc;
                                        }, {})).map((p: any, idx: number) => (
                                          <div key={idx} style={{ fontSize: '12px', color: '#475569', marginBottom: '2px' }}>
                                            {p.productName}{p.variantStr} {p.unitSuffix}x{p.quantity}
                                          </div>
                                        ))}
                                        {(!it.products || it.products.length === 0) && (
                                          <div style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>No items found</div>
                                        )}
                                      </div>
                                    </td>
                                    <td
                                      style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }}
                                      onClick={() => {
                                        const actualOrder = orders?.find(o => o.id === it.customerOrderIds[0]);
                                        if (actualOrder) setViewingOrder(actualOrder);
                                      }}
                                    >
                                      <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>{it.quantity}</div>
                                    </td>
                                    <td
                                      style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }}
                                      onClick={() => {
                                        const actualOrder = orders?.find(o => o.id === it.customerOrderIds[0]);
                                        if (actualOrder) setViewingOrder(actualOrder);
                                      }}
                                    >
                                      <div style={{ fontWeight: 600, color: '#10b981', fontSize: '13px' }}>
                                        {formatCurrency(it.amount)}
                                      </div>
                                    </td>
                                    <td
                                      style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }}
                                      onClick={() => {
                                        const actualOrder = orders?.find(o => o.id === it.customerOrderIds[0]);
                                        if (actualOrder) setViewingOrder(actualOrder);
                                      }}
                                    >
                                      <StatusBadge status="WAITING" />
                                    </td>
                                    <td style={{ padding: '16px', borderBottom: '1px solid #f1f5f9', textAlign: 'center', verticalAlign: 'middle' }} onClick={(e) => e.stopPropagation()}>
                                      <button
                                        onClick={() => {
                                          if (confirm('Are you sure you want to completely delete this customer and all their orders? This cannot be undone.')) {
                                            it.customerOrderIds.forEach((orderId: number) => {
                                              deleteMutation.mutate(orderId);
                                            });
                                          }
                                        }}
                                        style={{
                                          background: 'transparent',
                                          color: '#dc2626',
                                          border: 'none',
                                          padding: '8px',
                                          borderRadius: '8px',
                                          cursor: 'pointer',
                                          display: 'inline-flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#fee2e2'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        title="Delete Order"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              });
                            })()}
                          </tbody>
                        </table>
                        {/* Footer Action Buttons */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '16px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              onClick={() => setDispatchModalBatchId(batch.id)}
                              style={{
                                padding: '8px 16px',
                                borderRadius: '8px',
                                background: '#3b82f6',
                                color: 'white',
                                fontWeight: 600,
                                fontSize: '13px',
                                cursor: 'pointer',
                                border: 'none'
                              }}
                            >
                              Dispatch Delivery
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div
              style={{
                margin: '12px',
                padding: '32px',
                border: '2px dashed #cbd5e1',
                borderRadius: '16px',
                background: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b'
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => {
                e.preventDefault();
                const oIdsStr = e.dataTransfer.getData('orderIds');
                const oId = e.dataTransfer.getData('orderId');
                const vId = e.dataTransfer.getData('variantId');
                const vName = e.dataTransfer.getData('variantName');

                let orderIds: number[] = [];
                if (oIdsStr) {
                  try {
                    orderIds = JSON.parse(oIdsStr);
                  } catch (err) { }
                }
                if (orderIds.length === 0 && oId) {
                  orderIds = [Number(oId)];
                }

                if (orderIds.length > 0) {
                  setNewBatchPrompt({
                    isOpen: true,
                    orderIds: orderIds,
                    defaultBatchName: vName || 'New Batch',
                    basisVariantId: null
                  });
                }
              }}
            >
              <Package size={32} color="#94a3b8" style={{ marginBottom: '12px' }} />
              <div style={{ fontWeight: 600, fontSize: '15px', color: '#334155' }}>Create New Batch</div>
              <div style={{ fontSize: '13px', marginTop: '4px' }}>Drag and drop a customer order here</div>
            </div>

            <div style={{ borderBottom: '1px solid #e2e8f0', margin: '24px 12px 12px' }}></div>
          </div>
        )}

      </div>

      {/* Create Batch Prompt Modal */}
      {newBatchPrompt.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '100%', maxWidth: '440px', padding: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '16px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} color="#3b82f6" />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>Create New Batch</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#64748b' }}>Move customer to a new delivery batch.</p>
              </div>
            </div>

            <p style={{ margin: '0 0 24px 0', fontSize: '13px', color: '#475569', lineHeight: 1.5, background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <strong>Note:</strong> Creating this batch will remove it from the quota pool and deduct the quota progress for the remaining customers waiting for this product.
            </p>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#475569', marginBottom: '8px' }}>Batch Name (Optional)</label>
              <input
                type="text"
                value={newBatchPrompt.defaultBatchName}
                onChange={(e) => setNewBatchPrompt(prev => ({ ...prev, defaultBatchName: e.target.value }))}
                placeholder="e.g. North Route Delivery"
                style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '32px' }}>
              <button
                onClick={() => setNewBatchPrompt({ isOpen: false, orderIds: [], defaultBatchName: '', basisVariantId: null })}
                style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', color: '#475569', fontWeight: 600, fontSize: '14px', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                disabled={isBatchDispatching}
                onClick={() => {
                  batchDispatchMutation.mutate({ orderIds: newBatchPrompt.orderIds, batchName: newBatchPrompt.defaultBatchName || undefined, basisVariantId: newBatchPrompt.basisVariantId || undefined });
                  setNewBatchPrompt({ isOpen: false, orderIds: [], defaultBatchName: '', basisVariantId: null });
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '12px',
                  border: 'none',
                  background: '#3b82f6',
                  color: 'white',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  opacity: isBatchDispatching ? 0.7 : 1
                }}
              >
                {isBatchDispatching ? 'Creating...' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
