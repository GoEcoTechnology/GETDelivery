'use client';
import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CheckCircle2, Download, Package, MapPin, Truck, Info,
  Calendar, Search, RefreshCw, Phone, ChevronDown, ChevronRight,
  Layers, User, ChevronsUpDown, ShieldCheck, ArrowRight
} from 'lucide-react';
import ExcelJS from 'exceljs';

// ── Toast ─────────────────────────────────────────────────────────────────────
type Toast = { id: number; message: string; type: 'success' | 'error' | 'loading' };
let toastCounter = 0;

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const show = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter;
    setToasts(p => [...p, { id, message, type }]);
    if (type !== 'loading') setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
    return id;
  }, []);
  const dismiss = useCallback((id: number) => setToasts(p => p.filter(t => t.id !== id)), []);
  return { toasts, show, dismiss };
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    DELIVERED:  { bg: '#dcfce7', color: '#16a34a', label: 'Delivered' },
    COMPLETED:  { bg: '#dcfce7', color: '#16a34a', label: 'Completed' },
  };
  const s = map[status] ?? { bg: '#dcfce7', color: '#16a34a', label: 'Completed' };
  return (
    <span style={{ background: s.bg, color: s.color, padding: '4px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      <CheckCircle2 size={12} />
      {s.label}
    </span>
  );
}

export interface CompletedBatchItem {
  id: string;
  orderRef: string;
  customerOrderId?: number;
  productSummary: string;
  customerName: string;
  customerContact: string;
  dropoffAddress: string;
  driver: string;
  completedDate: Date;
  deliveryFee: number;
  productAmount: number;
  totalAmount: number;
  status: string;
  quantity: number;
  priority?: string;
  products?: any[];
}

export interface CompletedBatchGroup {
  id: string;
  type: 'BATCH';
  batchId: number;
  batchNumber: string;
  productName: string;
  variantName?: string;
  totalQuantity: number;
  quotaQuantity?: number;
  totalWeight?: number;
  pickupLocation?: string;
  driver: string;
  driverContact?: string;
  vehicle?: string;
  completedDate: Date;
  deliveryFee: number;
  productAmount: number;
  totalAmount: number;
  status: string;
  orders: CompletedBatchItem[];
}

export interface CompletedSingleDelivery {
  id: string;
  type: 'SINGLE';
  referenceId: string;
  productSummary: string;
  customerName: string;
  customerContact: string;
  dropoffAddress: string;
  pickupAddress?: string;
  driver: string;
  driverContact?: string;
  completedDate: Date;
  deliveryFee: number;
  productAmount: number;
  totalAmount: number;
  status: string;
  products?: any[];
}

export type CompletedDeliveryGroup = CompletedBatchGroup | CompletedSingleDelivery;

export default function CompletedDeliveriesClient() {
  const { toasts, show: showToast } = useToast();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ALL' | 'MARKETPLACE' | 'CREATED'>('ALL');
  const [exporting, setExporting] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Queries ─────────────────────────────────────────────────────────────────
  const { data: marketplaceBatches = [], isLoading: loadingBatches, refetch: refetchBatches } = useQuery({
    queryKey: ['completed-marketplace-batches'],
    queryFn: async () => {
      const res = await fetch('/api/admin/deliveries/marketplace?status=DELIVERED,COMPLETED&limit=300', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) throw new Error('Failed to fetch marketplace batches');
      return res.json();
    },
    refetchInterval: 30_000,
  });

  const { data: createdDeliveries = [], isLoading: loadingCreated, refetch: refetchCreated } = useQuery({
    queryKey: ['completed-created-deliveries'],
    queryFn: async () => {
      const res = await fetch('/api/deliveries?page=1&limit=500&status=DELIVERED,COMPLETED', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token') || ''}` }
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    refetchInterval: 30_000,
  });

  const isLoading = loadingBatches || loadingCreated;
  const refetchAll = () => { refetchBatches(); refetchCreated(); };

  // ── Grouped Data Mapping ────────────────────────────────────────────────────
  const deliveryGroups = useMemo<CompletedDeliveryGroup[]>(() => {
    const groups: CompletedDeliveryGroup[] = [];

    // 1. Marketplace Batches (Groups customers together!)
    for (const b of (marketplaceBatches as any[])) {
      const items = b.items || [];
      const driver = b.ownDriverName || b.partnerDriverName || 'Assigned Driver';
      const vehicle = b.ownVehicleType || b.suggestedVehicleType || '';
      const batchDate = b.completedAt ? new Date(b.completedAt) : new Date(b.createdAt);

      let batchTotalProduct = 0;
      let batchTotalDelivery = 0;
      let calculatedTotalQty = 0;

      const batchOrders: CompletedBatchItem[] = [];

      if (items.length === 0) {
        const fee = Number(b.deliveryFee || 0);
        batchTotalDelivery = fee;
        calculatedTotalQty = b.totalQuantity || 1;
        batchOrders.push({
          id: `batch-${b.id}-empty`,
          orderRef: b.batchNumber ? `#${b.batchNumber}` : `Batch #${b.id}`,
          productSummary: `${b.productName || 'Marketplace Item'}${b.variantName ? ` - ${b.variantName}` : ''} ×${b.totalQuantity || 1}`,
          customerName: 'Marketplace Batch',
          customerContact: '',
          dropoffAddress: b.pickupLocation || '—',
          driver,
          completedDate: batchDate,
          deliveryFee: fee,
          productAmount: 0,
          totalAmount: fee,
          status: b.status,
          quantity: b.totalQuantity || 1,
        });
      } else {
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const qty = Number(item.quantity) || 1;
          calculatedTotalQty += qty;
          const pa = Number(item.offeredAmount) || qty * Number(b.variantPrice || 0);
          const fee = Number(item.finalDeliveryPrice) || (Number(item.normalDeliveryFee || 0) + Number(item.urgentAdditionalFee || 0));

          batchTotalProduct += pa;
          batchTotalDelivery += fee;

          batchOrders.push({
            id: `batch-${b.id}-item-${item.id || idx}`,
            orderRef: item.customerOrderId ? `#${item.customerOrderId}` : (b.batchNumber ? `#${b.batchNumber}` : `Batch #${b.id}`),
            customerOrderId: item.customerOrderId,
            productSummary: `${b.productName || 'Product'}${b.variantName ? ` - ${b.variantName}` : ''} ×${qty}`,
            customerName: item.customerName || 'Unknown Customer',
            customerContact: item.customerContact || '',
            dropoffAddress: item.dropoffAddress || '—',
            driver,
            completedDate: item.deliveryDate ? new Date(item.deliveryDate) : batchDate,
            deliveryFee: fee,
            productAmount: pa,
            totalAmount: pa + fee,
            status: item.orderStatus || b.status,
            quantity: qty,
            priority: item.deliveryPriority,
            products: item.products,
          });
        }
      }

      groups.push({
        id: `batch-${b.id}`,
        type: 'BATCH',
        batchId: b.id,
        batchNumber: b.batchNumber ? `#${b.batchNumber}` : `Batch #${b.id}`,
        productName: b.productName || 'Batch Product',
        variantName: b.variantName || '',
        totalQuantity: calculatedTotalQty > 0 ? calculatedTotalQty : (b.totalQuantity || 1),
        quotaQuantity: b.quotaQuantity,
        totalWeight: Number(b.totalWeight) || 0,
        pickupLocation: b.pickupLocation || '',
        driver,
        driverContact: b.partnerDriverContact || '',
        vehicle,
        completedDate: batchDate,
        deliveryFee: batchTotalDelivery,
        productAmount: batchTotalProduct,
        totalAmount: batchTotalProduct + batchTotalDelivery,
        status: b.status,
        orders: batchOrders,
      });
    }

    // 2. Created / Direct Deliveries
    for (const d of (createdDeliveries as any[])) {
      const pa = parseFloat(d.offeredAmount || '0');
      const fee = parseFloat(d.finalDeliveryPrice || '0');
      const productStr = (d.products || []).length > 0
        ? d.products.map((p: any) => `${p.productName}${p.variantName ? ` - ${p.variantName}` : ''} ×${p.accumulatedQuantity || p.targetQuantity || 1}`).join(', ')
        : 'Custom Order';

      groups.push({
        id: `single-${d.id}`,
        type: 'SINGLE',
        referenceId: `#${d.id}`,
        productSummary: productStr,
        customerName: d.customerName || '—',
        customerContact: d.customerContact || '',
        dropoffAddress: d.dropoffAddress || '—',
        pickupAddress: d.pickupAddress || '',
        driver: d.partnerDriverName || 'Own Fleet',
        driverContact: d.partnerDriverContact || '',
        completedDate: d.completedAt ? new Date(d.completedAt) : new Date(d.createdAt),
        deliveryFee: fee,
        productAmount: pa,
        totalAmount: pa + fee,
        status: d.status,
        products: d.products || [],
      });
    }

    return groups.sort((a, b) => b.completedDate.getTime() - a.completedDate.getTime());
  }, [createdDeliveries, marketplaceBatches]);

  // ── Search & Filter ─────────────────────────────────────────────────────────
  const q = search.trim().toLowerCase();
  const filteredGroups = useMemo(() => {
    let result = deliveryGroups;

    // Filter by Tab
    if (activeTab === 'MARKETPLACE') {
      result = result.filter(g => g.type === 'BATCH');
    } else if (activeTab === 'CREATED') {
      result = result.filter(g => g.type === 'SINGLE');
    }

    // Filter by Query
    if (!q) return result;

    return result.filter(g => {
      if (g.type === 'SINGLE') {
        return (
          g.referenceId.toLowerCase().includes(q) ||
          g.productSummary.toLowerCase().includes(q) ||
          g.customerName.toLowerCase().includes(q) ||
          g.customerContact.toLowerCase().includes(q) ||
          g.dropoffAddress.toLowerCase().includes(q) ||
          g.driver.toLowerCase().includes(q)
        );
      } else {
        const batchMatches =
          g.batchNumber.toLowerCase().includes(q) ||
          g.productName.toLowerCase().includes(q) ||
          (g.variantName && g.variantName.toLowerCase().includes(q)) ||
          g.driver.toLowerCase().includes(q);

        if (batchMatches) return true;

        return g.orders.some(o =>
          o.orderRef.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerContact.toLowerCase().includes(q) ||
          o.dropoffAddress.toLowerCase().includes(q)
        );
      }
    });
  }, [deliveryGroups, activeTab, q]);

  // Total customer drops count
  const totalCustomerDrops = useMemo(() => {
    return deliveryGroups.reduce((acc, g) => acc + (g.type === 'BATCH' ? g.orders.length : 1), 0);
  }, [deliveryGroups]);

  // Expand / Collapse All
  const areAllExpanded = filteredGroups.length > 0 && filteredGroups.every(g => !!expandedIds[g.id]);
  const toggleExpandAll = () => {
    if (areAllExpanded) {
      setExpandedIds({});
    } else {
      const next: Record<string, boolean> = {};
      filteredGroups.forEach(g => { next[g.id] = true; });
      setExpandedIds(next);
    }
  };

  // ── Export to Excel ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    try {
      setExporting(true);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Completed Deliveries', {
        views: [{ showGridLines: true }],
      });

      sheet.columns = [
        { header: 'Batch Ref',         key: 'batchRef',       width: 22 },
        { header: 'Product Summary',   key: 'productSummary', width: 46 },
        { header: 'Customer Name',     key: 'customerName',   width: 26 },
        { header: 'Customer Contact',  key: 'customerContact',width: 18 },
        { header: 'Drop-off Address',  key: 'dropoffAddress', width: 50 },
        { header: 'Driver / Fleet',    key: 'driver',         width: 22 },
        { header: 'Delivery Fee',      key: 'deliveryFee',    width: 18 },
        { header: 'Total Amount',      key: 'totalAmount',    width: 20 },
        { header: 'Status',            key: 'status',         width: 16 },
        { header: 'Completed Date',    key: 'completedDate',  width: 24 },
      ];

      const formatDateForExcel = (d: Date) => {
        try {
          const mon = d.toLocaleString('en-US', { month: 'short' });
          const day = d.getDate();
          const yr = d.getFullYear();
          let hrs = d.getHours();
          const mins = String(d.getMinutes()).padStart(2, '0');
          const ampm = hrs >= 12 ? 'PM' : 'AM';
          hrs = hrs % 12 || 12;
          return `${mon} ${day}, ${yr} ${hrs}:${mins} ${ampm}`;
        } catch {
          return d.toLocaleDateString();
        }
      };

      const headerRow = sheet.getRow(1);
      headerRow.height = 30;
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Calibri' };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } };

      headerRow.eachCell((cell, colNumber) => {
        const key = sheet.columns[colNumber - 1]?.key;
        if (key === 'deliveryFee' || key === 'totalAmount') {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else if (key === 'batchRef' || key === 'customerContact' || key === 'status' || key === 'completedDate') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        }
      });

      const thinBorder: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };

      let totalFeeSum = 0;
      let totalAmountSum = 0;
      let totalRowCount = 0;

      for (const g of filteredGroups) {
        if (g.type === 'BATCH') {
          for (const o of g.orders) {
            totalRowCount++;
            totalFeeSum += o.deliveryFee || 0;
            totalAmountSum += o.totalAmount || 0;

            const actualProductSummary = (o.products && o.products.length > 0)
              ? o.products.map((p: any) => {
                  const v = p.variantName && !p.productName.toLowerCase().includes(p.variantName.toLowerCase()) ? ` - ${p.variantName}` : '';
                  return `${p.productName}${v} ×${p.quantity}`;
                }).join(', ')
              : o.productSummary;

            const row = sheet.addRow({
              batchRef: g.batchNumber,
              productSummary: actualProductSummary,
              customerName: o.customerName,
              customerContact: o.customerContact || 'N/A',
              dropoffAddress: o.dropoffAddress,
              driver: o.driver,
              deliveryFee: o.deliveryFee,
              totalAmount: o.totalAmount,
              status: 'DELIVERED',
              completedDate: formatDateForExcel(o.completedDate),
            });

            row.height = 24;
            row.alignment = { vertical: 'middle' };

            row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
              cell.border = thinBorder;
              cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
              const key = sheet.columns[colNumber - 1]?.key;

              if (key === 'batchRef') {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { size: 10, bold: true, color: { argb: 'FF16A34A' }, name: 'Calibri' };
              } else if (key === 'customerName') {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
                cell.font = { size: 10, bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri' };
              } else if (key === 'deliveryFee' || key === 'totalAmount') {
                cell.alignment = { vertical: 'middle', horizontal: 'right' };
                if (key === 'totalAmount') cell.font = { size: 10, bold: true, color: { argb: 'FF15803D' }, name: 'Calibri' };
              } else if (key === 'customerContact' || key === 'completedDate') {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
              } else if (key === 'status') {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.font = { size: 9, bold: true, color: { argb: 'FF16A34A' }, name: 'Calibri' };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
              } else {
                cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
              }
            });
          }
        } else {
          totalRowCount++;
          totalFeeSum += g.deliveryFee || 0;
          totalAmountSum += g.totalAmount || 0;

          const row = sheet.addRow({
            batchRef: g.referenceId ? `${g.referenceId} (Direct)` : 'Direct Delivery',
            productSummary: g.productSummary,
            customerName: g.customerName,
            customerContact: g.customerContact || 'N/A',
            dropoffAddress: g.dropoffAddress,
            driver: g.driver,
            deliveryFee: g.deliveryFee,
            totalAmount: g.totalAmount,
            status: 'DELIVERED',
            completedDate: formatDateForExcel(g.completedDate),
          });

          row.height = 24;
          row.alignment = { vertical: 'middle' };

          row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = thinBorder;
            cell.font = { size: 10, name: 'Calibri', color: { argb: 'FF1E293B' } };
            const key = sheet.columns[colNumber - 1]?.key;

            if (key === 'batchRef') {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { size: 10, bold: true, color: { argb: 'FF2563EB' }, name: 'Calibri' };
            } else if (key === 'customerName') {
              cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
              cell.font = { size: 10, bold: true, color: { argb: 'FF0F172A' }, name: 'Calibri' };
            } else if (key === 'deliveryFee' || key === 'totalAmount') {
              cell.alignment = { vertical: 'middle', horizontal: 'right' };
              if (key === 'totalAmount') cell.font = { size: 10, bold: true, color: { argb: 'FF15803D' }, name: 'Calibri' };
            } else if (key === 'customerContact' || key === 'completedDate') {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
            } else if (key === 'status') {
              cell.alignment = { vertical: 'middle', horizontal: 'center' };
              cell.font = { size: 9, bold: true, color: { argb: 'FF16A34A' }, name: 'Calibri' };
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
            } else {
              cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            }
          });
        }
      }

      sheet.getColumn('deliveryFee').numFmt = '"₱"#,##0.00';
      sheet.getColumn('totalAmount').numFmt = '"₱"#,##0.00';

      if (totalRowCount > 0) {
        const totalRow = sheet.addRow({
          batchRef: 'TOTALS',
          productSummary: `${totalRowCount} Completed Deliveries`,
          customerName: '',
          customerContact: '',
          dropoffAddress: '',
          driver: '',
          deliveryFee: totalFeeSum,
          totalAmount: totalAmountSum,
          status: '',
          completedDate: '',
        });

        totalRow.height = 28;
        totalRow.font = { bold: true, size: 11, color: { argb: 'FF0F172A' }, name: 'Calibri' };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };

        totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF16A34A' } },
            bottom: { style: 'double', color: { argb: 'FF16A34A' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          const key = sheet.columns[colNumber - 1]?.key;
          if (key === 'batchRef') {
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
          } else if (key === 'deliveryFee' || key === 'totalAmount') {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            cell.font = { bold: true, size: 11, color: { argb: 'FF15803D' }, name: 'Calibri' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
          }
        });
      }

      sheet.columns.forEach(column => {
        let maxLen = column.header ? String(column.header).length : 12;
        column.eachCell?.({ includeEmpty: false }, (cell, rowNumber) => {
          if (rowNumber === 1) return;
          const val = cell.value ? String(cell.value) : '';
          if (val.length > maxLen) {
            maxLen = val.length;
          }
        });
        column.width = Math.min(Math.max(maxLen + 4, column.width || 14), 58);
      });

      const buf = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url;
      a.download = `Completed_Deliveries_${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click(); URL.revokeObjectURL(url);
      showToast('Exported successfully!', 'success');
    } catch {
      showToast('Export failed.', 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: '24px', minHeight: '100vh', background: '#f8fafc' }}>
      {/* Toast */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '8px', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ padding: '12px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, backgroundColor: t.type === 'error' ? '#fef2f2' : '#ecfdf5', color: t.type === 'error' ? '#dc2626' : '#16a34a', border: `1px solid ${t.type === 'error' ? '#fecaca' : '#bbf7d0'}`, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', pointerEvents: 'auto' }}>
            {t.message}
          </div>
        ))}
      </div>

      {/* Page Header */}
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #16a34a, #22c55e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(22,163,74,0.3)', flexShrink: 0 }}>
            <CheckCircle2 size={22} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '10px' }}>
              Completed Deliveries
              <span
                style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '24px', height: '24px', borderRadius: '50%', background: '#2563eb', cursor: 'pointer', flexShrink: 0, boxShadow: '0 2px 8px rgba(37,99,235,0.35)' }}>
                  <Info size={14} color="white" />
                </span>
                {showTooltip && (
                  <span style={{ position: 'absolute', top: 'calc(100% + 10px)', left: '0', background: '#1e293b', color: '#cbd5e1', fontSize: '12.5px', fontWeight: 400, lineHeight: '1.7', padding: '14px 18px', borderRadius: '12px', width: '320px', whiteSpace: 'normal', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 200, pointerEvents: 'none', borderTop: '3px solid #f59e0b' }}>
                    <strong style={{ color: '#ffffff', display: 'block', marginBottom: '6px', fontSize: '13px', letterSpacing: '0.02em' }}>Data Retention Policy</strong>
                    Completed delivery records are permanently removed from the system <strong style={{ color: '#ffffff' }}>30 days after completion</strong>. Export your records to Excel prior to this period to retain historical archives.
                  </span>
                )}
              </span>
            </h1>
            <div style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>
              Batch deliveries keep all assigned customer orders grouped together for accurate trip records.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Expand/Collapse All Button */}
          {filteredGroups.length > 0 && (
            <button
              onClick={toggleExpandAll}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', borderRadius: '10px',
                border: '1.5px solid #e2e8f0', background: 'white', color: '#334155', fontWeight: 700, fontSize: '12.5px',
                cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
              }}
              title={areAllExpanded ? 'Collapse All' : 'Expand All'}
            >
              <ChevronsUpDown size={15} color="#64748b" />
              <span>{areAllExpanded ? 'Collapse All' : 'Expand All'}</span>
            </button>
          )}

          <button onClick={refetchAll} disabled={isLoading} style={{ width: '38px', height: '38px', border: '1.5px solid #e2e8f0', borderRadius: '10px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} title="Refresh">
            <RefreshCw size={16} color="#64748b" style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
          </button>
          <button onClick={handleExport} disabled={exporting || filteredGroups.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '12px', border: '1.5px solid #bbf7d0', background: '#f0fdf4', color: '#16a34a', fontWeight: 700, fontSize: '13px', cursor: (exporting || filteredGroups.length === 0) ? 'not-allowed' : 'pointer', opacity: (exporting || filteredGroups.length === 0) ? 0.6 : 1, boxShadow: '0 2px 8px rgba(22,163,74,0.1)' }}>
            <Download size={15} /> {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Source Tabs */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setActiveTab('ALL')}
              style={{
                padding: '7px 16px', borderRadius: '999px', border: '1.5px solid',
                borderColor: activeTab === 'ALL' ? '#16a34a' : '#e2e8f0',
                background: activeTab === 'ALL' ? '#16a34a' : 'white',
                color: activeTab === 'ALL' ? 'white' : '#64748b',
                fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Layers size={14} /> All Deliveries
              <span style={{ background: activeTab === 'ALL' ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: activeTab === 'ALL' ? 'white' : '#0f172a', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                {totalCustomerDrops}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('MARKETPLACE')}
              style={{
                padding: '7px 16px', borderRadius: '999px', border: '1.5px solid',
                borderColor: activeTab === 'MARKETPLACE' ? '#16a34a' : '#e2e8f0',
                background: activeTab === 'MARKETPLACE' ? '#16a34a' : 'white',
                color: activeTab === 'MARKETPLACE' ? 'white' : '#64748b',
                fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Truck size={14} /> Marketplace Batches
              {marketplaceBatches.length > 0 && (
                <span style={{ background: activeTab === 'MARKETPLACE' ? 'rgba(255,255,255,0.25)' : '#dcfce7', color: activeTab === 'MARKETPLACE' ? 'white' : '#16a34a', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                  {marketplaceBatches.length} {marketplaceBatches.length === 1 ? 'batch' : 'batches'}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('CREATED')}
              style={{
                padding: '7px 16px', borderRadius: '999px', border: '1.5px solid',
                borderColor: activeTab === 'CREATED' ? '#16a34a' : '#e2e8f0',
                background: activeTab === 'CREATED' ? '#16a34a' : 'white',
                color: activeTab === 'CREATED' ? 'white' : '#64748b',
                fontWeight: 700, fontSize: '12.5px', cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: '6px'
              }}
            >
              <Package size={14} /> Created Deliveries
              {createdDeliveries.length > 0 && (
                <span style={{ background: activeTab === 'CREATED' ? 'rgba(255,255,255,0.25)' : '#f1f5f9', color: activeTab === 'CREATED' ? 'white' : '#0f172a', padding: '1px 7px', borderRadius: '999px', fontSize: '11px', fontWeight: 800 }}>
                  {createdDeliveries.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '12px 18px', display: 'flex', gap: '12px', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by customer name, order ref, batch #, product, location, or driver..."
              style={{ width: '100%', padding: '10px 14px 10px 40px', border: '1.5px solid #e2e8f0', borderRadius: '10px', fontSize: '13px', outline: 'none', color: '#0f172a', background: '#fafafa', boxSizing: 'border-box' }}
            />
          </div>
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: '13px', fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Accordion Dropdown List (No Tables!) */}
      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px', color: '#94a3b8', fontSize: '14px', gap: '10px' }}>
          <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} /> Loading completed deliveries…
        </div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', padding: '80px 24px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.03)' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '20px', background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} color="#16a34a" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>No Completed Deliveries</h2>
          <p style={{ margin: 0, fontSize: '14px', color: '#64748b' }}>{search ? 'No results match your search query.' : 'Fulfilled deliveries marked as complete will appear here.'}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredGroups.map(group => {
            const isExpanded = !!expandedIds[group.id];

            if (group.type === 'BATCH') {
              return (
                <div
                  key={group.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: isExpanded ? '1.5px solid #86efac' : '1px solid #e2e8f0',
                    boxShadow: isExpanded ? '0 8px 24px rgba(22, 163, 74, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Clickable Dropdown Header */}
                  <div
                    onClick={() => toggleExpand(group.id)}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      background: isExpanded ? 'linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%)' : 'white',
                      userSelect: 'none',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Left: Icon, Badge, Product & Drop info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: '1 1 450px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isExpanded ? '#dcfce7' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'transform 0.2s'
                        }}
                      >
                        {isExpanded ? <ChevronDown size={18} color="#16a34a" /> : <ChevronRight size={18} color="#64748b" />}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#16a34a', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Truck size={13} /> {group.batchNumber}
                        </span>

                        <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                          {group.productName} {group.variantName ? `— ${group.variantName}` : ''}
                        </span>

                        <span style={{ background: '#dcfce7', color: '#16a34a', padding: '2px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800 }}>
                          {group.totalQuantity} Units Total
                        </span>

                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', background: isExpanded ? 'white' : '#f8fafc', border: '1px solid #cbd5e1', padding: '2px 8px', borderRadius: '6px' }}>
                          {group.orders.length} {group.orders.length === 1 ? 'Customer Drop' : 'Customer Drops (Batched)'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Driver, Date, Total Amount, Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
                        <Truck size={14} color="#16a34a" />
                        <span>{group.driver}</span>
                        {group.vehicle && <span style={{ color: '#64748b', fontSize: '12px' }}>({group.vehicle})</span>}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#64748b' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{group.completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div style={{ color: '#16a34a', fontSize: '15px', fontWeight: 800 }}>₱{formatCurrency(group.totalAmount)}</div>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Fee: ₱{formatCurrency(group.deliveryFee)}</div>
                      </div>

                      <StatusBadge status={group.status} />
                    </div>
                  </div>

                  {/* Dropdown Expanded Panel: View All Data */}
                  {isExpanded && (
                    <div style={{ padding: '20px 24px', background: '#fafbfc', borderTop: '1px solid #bbf7d0' }}>
                      {/* Trip Information Summary Bar */}
                      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '14px 18px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '13px' }}>
                          <div>
                            <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Assigned Driver</span>
                            <strong style={{ color: '#0f172a' }}>{group.driver}</strong>
                            {group.driverContact && <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '12px' }}>({group.driverContact})</span>}
                          </div>
                          {group.vehicle && (
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Assigned Vehicle</span>
                              <strong style={{ color: '#0f172a' }}>{group.vehicle}</strong>
                            </div>
                          )}
                          {group.pickupLocation && (
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Pickup Warehouse</span>
                              <span style={{ color: '#334155' }}>{group.pickupLocation}</span>
                            </div>
                          )}
                          {group.totalWeight ? (
                            <div>
                              <span style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, display: 'block', marginBottom: '2px' }}>Cargo Weight</span>
                              <strong style={{ color: '#0f172a' }}>{group.totalWeight} kg</strong>
                            </div>
                          ) : null}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '4px 10px', borderRadius: '8px', color: '#16a34a', fontSize: '12px', fontWeight: 700 }}>
                          <ShieldCheck size={14} /> Batch Delivery Completed
                        </div>
                      </div>

                      {/* Customer Drop-offs Header */}
                      <div style={{ fontSize: '12px', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Layers size={14} color="#16a34a" /> All Customer Orders in this Batch ({group.orders.length})
                      </div>

                      {/* Customer Drop-off Cards List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {group.orders.map((order, oIdx) => (
                          <div
                            key={order.id}
                            style={{
                              background: 'white',
                              borderRadius: '12px',
                              border: '1px solid #e2e8f0',
                              borderLeft: '4px solid #16a34a',
                              padding: '16px 20px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              flexWrap: 'wrap',
                              gap: '16px',
                              transition: 'box-shadow 0.15s'
                            }}
                          >
                            {/* Drop & Customer Info */}
                            <div style={{ flex: '1 1 320px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ background: '#dcfce7', color: '#16a34a', fontSize: '11px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px' }}>
                                  Drop #{oIdx + 1}
                                </span>
                                <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '13.5px' }}>
                                  {order.orderRef}
                                </span>
                                {order.priority === 'URGENT' && (
                                  <span style={{ background: '#fef2f2', color: '#dc2626', fontSize: '10.5px', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>
                                    URGENT
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 700, color: '#1e293b', fontSize: '13.5px' }}>
                                  <User size={13} color="#64748b" />
                                  <span>{order.customerName}</span>
                                </div>
                                {order.customerContact && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '12px' }}>
                                    <Phone size={11} color="#94a3b8" />
                                    <span>{order.customerContact}</span>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#475569', fontSize: '12.5px' }}>
                                <MapPin size={13} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
                                <span>{order.dropoffAddress}</span>
                              </div>
                            </div>

                            {/* Product Info */}
                            <div style={{ flex: '1 1 260px' }}>
                              <div style={{ fontSize: '11.5px', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>Product & Quantity</div>
                              {order.products && order.products.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {order.products.map((p: any, pIdx: number) => {
                                    const variantPart = p.variantName && !p.productName.toLowerCase().includes(p.variantName.toLowerCase())
                                      ? ` - ${p.variantName}`
                                      : '';
                                    return (
                                      <div key={p.itemId || pIdx} style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span style={{ color: '#16a34a', fontWeight: 800 }}>•</span>
                                        <span>
                                          {p.productName}{variantPart}{' '}
                                          <strong style={{ color: '#0f172a' }}>× {p.quantity}{p.unit ? ` ${p.unit}` : ''}</strong>
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ fontSize: '12.5px', color: '#0f172a', fontWeight: 600 }}>
                                  {order.productSummary}
                                </div>
                              )}
                            </div>

                            {/* Financials & Status */}
                            <div style={{ textAlign: 'right', minWidth: '140px' }}>
                              <div style={{ fontWeight: 800, color: '#16a34a', fontSize: '15px' }}>
                                ₱{formatCurrency(order.totalAmount)}
                              </div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>
                                Product: ₱{formatCurrency(order.productAmount)}
                              </div>
                              {order.deliveryFee > 0 && (
                                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                                  Fee: ₱{formatCurrency(order.deliveryFee)}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Grand Total Summary Box for this Batch */}
                      <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                        <div style={{ width: '300px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                            <span>Total Product Amount:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>₱{formatCurrency(group.productAmount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
                            <span>Total Batch Delivery Fees:</span>
                            <span style={{ fontWeight: 700, color: '#1e293b' }}>₱{formatCurrency(group.deliveryFee)}</span>
                          </div>
                          <div style={{ height: '1px', background: '#e2e8f0', margin: '0 -20px 10px -20px' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>Batch Grand Total</span>
                            <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '18px' }}>₱{formatCurrency(group.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            } else {
              // Direct / Created Delivery List Item
              return (
                <div
                  key={group.id}
                  style={{
                    background: 'white',
                    borderRadius: '16px',
                    border: isExpanded ? '1.5px solid #93c5fd' : '1px solid #e2e8f0',
                    boxShadow: isExpanded ? '0 8px 24px rgba(37, 99, 235, 0.08)' : '0 2px 6px rgba(0,0,0,0.02)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {/* Clickable Dropdown Header */}
                  <div
                    onClick={() => toggleExpand(group.id)}
                    style={{
                      padding: '16px 20px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '14px',
                      background: isExpanded ? 'linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%)' : 'white',
                      userSelect: 'none',
                      transition: 'background 0.15s'
                    }}
                  >
                    {/* Left: Icon, Badge, Product & Customer */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', flex: '1 1 450px' }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          background: isExpanded ? '#dbeafe' : '#f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isExpanded ? <ChevronDown size={18} color="#2563eb" /> : <ChevronRight size={18} color="#64748b" />}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ background: '#2563eb', color: 'white', padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                          <Package size={13} /> {group.referenceId}
                        </span>

                        <span style={{ fontSize: '14.5px', fontWeight: 800, color: '#0f172a' }}>
                          {group.productSummary}
                        </span>

                        <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 9px', borderRadius: '999px', fontSize: '11.5px', fontWeight: 800 }}>
                          Direct Delivery
                        </span>

                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
                          Customer: <strong style={{ color: '#0f172a' }}>{group.customerName}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Right: Driver, Date, Total Amount, Status */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
                        <Truck size={14} color="#64748b" />
                        <span>{group.driver}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12.5px', color: '#64748b' }}>
                        <Calendar size={13} color="#94a3b8" />
                        <span>{group.completedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '100px' }}>
                        <div style={{ color: '#16a34a', fontSize: '15px', fontWeight: 800 }}>₱{formatCurrency(group.totalAmount)}</div>
                        {group.deliveryFee > 0 && (
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Fee: ₱{formatCurrency(group.deliveryFee)}</div>
                        )}
                      </div>

                      <StatusBadge status={group.status} />
                    </div>
                  </div>

                  {/* Dropdown Expanded Panel: View All Data for Direct Delivery */}
                  {isExpanded && (
                    <div style={{ padding: '20px 24px', background: '#fafbfc', borderTop: '1px solid #bfdbfe' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        {/* Customer & Location */}
                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                          <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                            Customer & Drop-off Details
                          </div>
                          <div style={{ fontWeight: 800, color: '#0f172a', fontSize: '14.5px', marginBottom: '4px' }}>
                            {group.customerName}
                          </div>
                          {group.customerContact && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '12.5px', marginBottom: '6px' }}>
                              <Phone size={12} color="#94a3b8" />
                              <span>{group.customerContact}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#475569', fontSize: '12.5px', marginTop: '6px' }}>
                            <MapPin size={13} color="#94a3b8" style={{ flexShrink: 0, marginTop: '2px' }} />
                            <span><strong>Drop-off:</strong> {group.dropoffAddress}</span>
                          </div>
                          {group.pickupAddress && (
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', color: '#475569', fontSize: '12.5px', marginTop: '4px' }}>
                              <MapPin size={13} color="#2563eb" style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span><strong>Pickup:</strong> {group.pickupAddress}</span>
                            </div>
                          )}
                        </div>

                        {/* Driver & Delivery Fulfillment */}
                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                          <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                            Fulfillment Details
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, color: '#0f172a', fontSize: '14px', marginBottom: '6px' }}>
                            <Truck size={15} color="#2563eb" />
                            <span>Driver: {group.driver}</span>
                          </div>
                          {group.driverContact && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#64748b', fontSize: '12.5px', marginBottom: '8px' }}>
                              <Phone size={12} color="#94a3b8" />
                              <span>{group.driverContact}</span>
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '12.5px' }}>
                            <Calendar size={13} color="#94a3b8" />
                            <span>Completed: {group.completedDate.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Amount Breakdown */}
                        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 20px' }}>
                          <div style={{ fontSize: '11.5px', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, marginBottom: '8px' }}>
                            Payment Summary
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>
                            <span>Offered Product Amount:</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>₱{formatCurrency(group.productAmount)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#64748b', marginBottom: '10px' }}>
                            <span>Delivery Fee:</span>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>₱{formatCurrency(group.deliveryFee)}</span>
                          </div>
                          <div style={{ height: '1px', background: '#e2e8f0', margin: '0 -20px 10px -20px' }} />
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#0f172a' }}>TOTAL AMOUNT</span>
                            <span style={{ color: '#16a34a', fontWeight: 800, fontSize: '17px' }}>₱{formatCurrency(group.totalAmount)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
