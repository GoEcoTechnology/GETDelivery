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

  // Fetch data on the server with RLS
  const data = await withRLS(claims, async (tx) => {
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    const tenantCondition = tenantIdToUse ? sql`tenant_id = ${tenantIdToUse}` : sql`1=1`;

    const [inventoryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(stock) as total_units_in_stock
      FROM ${products}
      WHERE ${tenantCondition}
    `);

    const [deliveryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_deliveries,
        SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
      FROM ${deliveryOrders}
      WHERE ${tenantCondition}
    `);

    const lowStockItems = await tx
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(
        tenantIdToUse 
          ? and(eq(products.tenantId, tenantIdToUse as number), sql`stock <= low_stock_threshold`) 
          : sql`stock <= low_stock_threshold`
      )
      .limit(5);

    return {
      inventory: {
        totalProducts: parseInt((inventoryStats as any).total_products) || 0,
        lowStockCount: parseInt((inventoryStats as any).low_stock_count) || 0,
        totalUnits: parseInt((inventoryStats as any).total_units_in_stock) || 0,
        lowStockItems
      },
      deliveries: {
        total: parseInt((deliveryStats as any).total_deliveries) || 0,
        pending: parseInt((deliveryStats as any).pending_deliveries) || 0,
        completed: parseInt((deliveryStats as any).completed_deliveries) || 0,
        inTransit: parseInt((deliveryStats as any).in_transit_deliveries) || 0,
      }
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
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: '24px' }}>
        <h3>Immediate Action Required: Low Stock Items</h3>
        {data.inventory.lowStockItems && data.inventory.lowStockItems.length > 0 ? (
          <table className={styles.table} style={{ marginTop: '16px' }}>
            <thead>
              <tr>
                <th>Product ID</th>
                <th>Product Name</th>
                <th>Current Stock</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.lowStockItems.map((item: any) => (
                <tr key={item.id}>
                  <td>#{item.id}</td>
                  <td style={{ fontWeight: 500 }}>{item.name}</td>
                  <td style={{ color: '#ef4444', fontWeight: 600 }}>{item.stock}</td>
                  <td>
                    {/* Note: since this is a Server Component, we use standard link or a form, but for a simple button window.location won't work cleanly unless we use an anchor tag or Client Component wrapper. Let's use an anchor tag. */}
                    <a 
                      href="/admin/inventory/stock-in"
                      style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }}
                    >
                      Stock In
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p style={{ marginTop: '16px', color: '#64748b' }}>All products are well stocked.</p>
        )}
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
