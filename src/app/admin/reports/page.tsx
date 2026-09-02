import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { db, withRLS } from '@/db';
import { products, deliveryOrders } from '@/db/schema';
import { eq, sql, and } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import styles from '../admin.module.css';

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  // Employees cannot access reports
  if (claims.role === 'EMPLOYEE') {
    redirect('/admin/deliveries');
  }

  // Fetch data on the server with RLS
  const data = await withRLS(claims, async (tx) => {
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    const tenantCondition = tenantIdToUse ? sql`tenant_id = ${tenantIdToUse}` : sql`1=1`;

    const [inventoryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(stock) as total_units_in_stock,
        SUM(COALESCE(stock,0) * COALESCE(price,0)) as total_inventory_value
      FROM ${products}
      WHERE ${tenantCondition}
    `);

    const [deliveryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_deliveries,
        SUM(COALESCE(offered_amount,0)) as total_order_value,
        SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
      FROM ${deliveryOrders}
      WHERE ${tenantCondition}
    `);

    const lowStockItems = await tx
      .select({ id: products.id, name: products.name, stock: products.stock, low: products.lowStockThreshold, price: products.price })
      .from(products)
      .where(
        tenantIdToUse
          ? and(eq(products.tenantId, tenantIdToUse as number), sql`stock <= low_stock_threshold`)
          : sql`stock <= low_stock_threshold`
      )
      .limit(5);

    const recentDeliveries = await tx
      .select({ id: deliveryOrders.id, status: deliveryOrders.status, createdAt: deliveryOrders.createdAt, offeredAmount: deliveryOrders.offeredAmount })
      .from(deliveryOrders)
      .where(tenantIdToUse ? eq(deliveryOrders.tenantId, tenantIdToUse as number) : sql`1=1`)
      .orderBy(sql`created_at DESC`)
      .limit(5);

    return {
      inventory: {
        totalProducts: parseInt((inventoryStats as any).total_products) || 0,
        lowStockCount: parseInt((inventoryStats as any).low_stock_count) || 0,
        totalUnits: parseInt((inventoryStats as any).total_units_in_stock) || 0,
        lowStockItems,
        totalValue: parseFloat((inventoryStats as any).total_inventory_value) || 0
      },
      deliveries: {
        total: parseInt((deliveryStats as any).total_deliveries) || 0,
        totalValue: parseFloat((deliveryStats as any).total_order_value) || 0,
        pending: parseInt((deliveryStats as any).pending_deliveries) || 0,
        completed: parseInt((deliveryStats as any).completed_deliveries) || 0,
        inTransit: parseInt((deliveryStats as any).in_transit_deliveries) || 0,
      },
      recentDeliveries,
    };
  });

  if (!data) return <div className={styles.error}>Failed to load reports</div>;

  return (
    <div>
      <div className={styles.header}>
        <h1>Reports & Analytics</h1>
        <p>Comprehensive overview of your inventory and deliveries</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div className={styles.card}>
          <h3>Delivery Performance</h3>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={statRow}>
              <span>Total Deliveries</span>
              <span style={{ fontWeight: 600 }}>{data.deliveries.total}</span>
            </div>
            <div style={statRow}>
              <span>Pending / Ready for Dispatch</span>
              <span style={{ fontWeight: 600, color: '#f59e0b' }}>{data.deliveries.pending}</span>
            </div>
            <div style={statRow}>
              <span>In Transit</span>
              <span style={{ fontWeight: 600, color: '#3b82f6' }}>{data.deliveries.inTransit}</span>
            </div>
            <div style={statRow}>
              <span>Successfully Completed</span>
              <span style={{ fontWeight: 600, color: '#10b981' }}>{data.deliveries.completed}</span>
            </div>
            <div style={statRow}>
              <span>Total Order Value</span>
              <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.deliveries.totalValue || 0)}</span>
            </div>
          </div>
        </div>

        <div className={styles.card}>
          <h3>Inventory Valuation & Stats</h3>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={statRow}>
              <span>Total Unique Products</span>
              <span style={{ fontWeight: 600 }}>{data.inventory.totalProducts}</span>
            </div>
            <div style={statRow}>
              <span>Total Units in Stock</span>
              <span style={{ fontWeight: 600 }}>{data.inventory.totalUnits}</span>
            </div>
            <div style={statRow}>
              <span>Items Low on Stock</span>
              <span style={{ fontWeight: 600, color: '#ef4444' }}>{data.inventory.lowStockCount}</span>
            </div>
            <div style={statRow}>
              <span>Total Inventory Value</span>
              <span style={{ fontWeight: 600 }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.inventory.totalValue || 0)}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: '24px', marginTop: '24px' }}>
        <div className={styles.card}>
          <h3>Reorder Suggestions</h3>
          <p style={{ marginTop: 8, color: '#64748b' }}>Suggested quantities to reorder for low stock items.</p>
          {data.inventory.lowStockItems && data.inventory.lowStockItems.length > 0 ? (
            <table className={styles.table} style={{ marginTop: '12px' }}>
              <thead>
                    <tr>
                      <th>Product</th>
                      <th>Stock</th>
                      <th>Unit Price</th>
                      <th>Suggested Qty</th>
                      <th>Suggested Cost</th>
                      <th>Action</th>
                    </tr>
              </thead>
              <tbody>
                {data.inventory.lowStockItems.map((item: any) => {
                  const lowThreshold = (item.low as number) || 10;
                  const suggested = Math.max(1, lowThreshold * 2 - (item.stock || 0));
                  const price = parseFloat(item.price || 0);
                  const suggestedCost = suggested * price;
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>{item.name}</td>
                      <td style={{ color: '#ef4444', fontWeight: 600 }}>{item.stock}</td>
                      <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)}</td>
                      <td style={{ fontWeight: 600 }}>{suggested}</td>
                      <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(suggestedCost)}</td>
                      <td>
                        <a href="/admin/inventory/stock-in" className={styles.btnPrimary}>Stock In</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={{ marginTop: '12px', color: '#64748b' }}>No reorder suggestions — inventory looks healthy.</p>
          )}
        </div>

        <aside className={styles.card} style={{ height: 'fit-content' }}>
          <h3>Recent Deliveries</h3>
          <ul style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', paddingLeft: 0 }}>
            {data.recentDeliveries && data.recentDeliveries.length > 0 ? (
              data.recentDeliveries.map((d: any) => (
                <li key={d.id} style={{ listStyle: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>#{d.id}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{new Date(d.createdAt).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, color: d.status === 'DELIVERED' ? '#10b981' : d.status === 'IN_TRANSIT' ? '#3b82f6' : '#f59e0b' }}>{d.status}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{d.offeredAmount ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(d.offeredAmount)) : '-'}</div>
                  </div>
                </li>
              ))
            ) : (
              <p style={{ color: '#64748b' }}>No recent deliveries.</p>
            )}
          </ul>
        </aside>
      </div>
    </div>
  );
}

const statRow = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  borderBottom: '1px solid #e2e8f0',
  fontSize: '14px'
};
