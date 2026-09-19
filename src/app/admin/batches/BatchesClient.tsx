'use client';
import { useState } from 'react';
import { Package, MapPin, Truck, ChevronRight } from 'lucide-react';
import styles from '../admin.module.css';

interface BatchItem {
  id: number;
  batchId: number;
  quantity: number;
  customerWeight: string;
  customerName: string;
  customerContact: string | null;
  dropoffAddress: string;
}

interface DeliveryBatch {
  id: number;
  batchNumber: string;
  totalQuantity: number;
  quotaQuantity: number;
  totalWeight: string;
  pickupLocation: string;
  status: string;
  createdAt: Date;
  variantName: string;
  productName: string;
  items: BatchItem[];
}

export default function BatchesClient({ initialBatches }: { initialBatches: DeliveryBatch[] }) {
  const [batches, setBatches] = useState<DeliveryBatch[]>(initialBatches);
  
  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Delivery Batches</h1>
          <p style={{ color: '#64748b', margin: 0 }}>Manage quota-fulfilled delivery batches ready for dispatch.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {batches.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
            <Package size={48} color="#94a3b8" style={{ margin: '0 auto 16px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#334155', fontSize: '18px' }}>No Delivery Batches Yet</h3>
            <p style={{ color: '#64748b', margin: 0 }}>Batches will automatically generate when product variants hit their quota.</p>
          </div>
        ) : (
          batches.map(batch => (
            <div key={batch.id} className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={24} color="#4f46e5" />
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>Batch {batch.batchNumber}</h3>
                    <div style={{ fontSize: '14px', color: '#64748b', display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#4f46e5' }}>{batch.productName} - {batch.variantName}</span>
                      <span>•</span>
                      <span>Created {new Date(batch.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ display: 'inline-flex', padding: '6px 12px', borderRadius: '999px', background: '#dcfce7', color: '#16a34a', fontSize: '12px', fontWeight: 700, marginBottom: '8px' }}>
                    {batch.status.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>
                    Total: {batch.totalWeight} kg
                  </div>
                </div>
              </div>

              <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', fontSize: '14px' }}>
                  <span style={{ color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Customers in this Batch ({batch.items.length})</span>
                  <span style={{ color: '#4f46e5', fontWeight: 700 }}>{batch.totalQuantity} / {batch.quotaQuantity} Quota Reached</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {batch.items.map(item => (
                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <MapPin size={20} color="#94a3b8" style={{ marginTop: '2px' }} />
                        <div>
                          <div style={{ fontWeight: 700, color: '#1e293b', marginBottom: '4px' }}>{item.customerName}</div>
                          <div style={{ fontSize: '13px', color: '#64748b', maxWidth: '400px' }}>{item.dropoffAddress}</div>
                          {item.customerContact && <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>📞 {item.customerContact}</div>}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '16px' }}>{item.quantity} units</span>
                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>{item.customerWeight} kg</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
