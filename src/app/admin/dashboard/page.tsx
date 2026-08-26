import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { db, withRLS } from '@/db';
import { products, deliveryOrders, inventoryTransactions, customers, drivers, vehicles } from '@/db/schema';
import { eq, sql, and, gte } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import styles from '../admin.module.css';

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) {
    redirect('/login');
  }

  const claims = await verifyToken(token);
  if (!claims) {
    redirect('/login');
  }

  const { range: rangeParam } = await searchParams;
  const range = rangeParam || 'month';

  try {
    const data = await withRLS(claims, async (tx) => {
      const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
      const tenantCondition = tenantIdToUse ? sql`tenant_id = ${tenantIdToUse}` : sql`1=1`;

      // 1. Prepare Dates for Charts
      const now = new Date();
      let startDate = new Date();
      if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (range === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (range === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      }

      // 2. Prepare Stats Queries
      const inventoryStatsQuery = tx.execute(sql`
        SELECT 
          COUNT(id) as total_products,
          SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
          SUM(stock) as total_units_in_stock
        FROM ${products}
        WHERE ${tenantCondition}
      `);

      const deliveryStatsQuery = tx.execute(sql`
        SELECT 
          COUNT(id) as total_deliveries,
          SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
          SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
          SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
        FROM ${deliveryOrders}
        WHERE ${tenantCondition}
      `);

      const customerStatsQuery = tx.execute(sql`
        SELECT COUNT(id) as active_customers
        FROM ${customers}
        WHERE ${tenantCondition} AND status = 'ACTIVE'
      `);

      const driverStatsQuery = tx.execute(sql`
        SELECT COUNT(id) as expiring_licenses
        FROM ${drivers}
        WHERE ${tenantCondition} AND (license_expiry <= NOW() + INTERVAL '30 days' OR license_expiry IS NULL)
      `);

      const vehicleStatsQuery = tx.execute(sql`
        SELECT COUNT(id) as expiring_registrations
        FROM ${vehicles}
        WHERE ${tenantCondition} AND (registration_expiry <= NOW() + INTERVAL '30 days' OR registration_expiry IS NULL)
      `);

      // 3. Prepare Chart Queries
      let statusQuery = tx.select({
        status: deliveryOrders.status,
        value: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(gte(deliveryOrders.createdAt, startDate))
      .groupBy(deliveryOrders.status);

      if (tenantIdToUse) {
        statusQuery = tx.select({
          status: deliveryOrders.status,
          value: sql<number>`count(*)::int`
        }).from(deliveryOrders)
        .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
        .groupBy(deliveryOrders.status);
      }
      
      let dailyQuery = tx.select({
        date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
        count: sql<number>`count(*)::int`
      }).from(deliveryOrders)
      .where(gte(deliveryOrders.createdAt, startDate))
      .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
      .orderBy(sql`DATE(${deliveryOrders.createdAt})`);

      if (tenantIdToUse) {
         dailyQuery = tx.select({
          date: sql<string>`DATE(${deliveryOrders.createdAt})::text`,
          count: sql<number>`count(*)::int`
        }).from(deliveryOrders)
        .where(and(eq(deliveryOrders.tenantId, tenantIdToUse as number), gte(deliveryOrders.createdAt, startDate)))
        .groupBy(sql`DATE(${deliveryOrders.createdAt})`)
        .orderBy(sql`DATE(${deliveryOrders.createdAt})`);
      }

      let inventoryQuery = tx.select({
        date: sql<string>`DATE(${inventoryTransactions.createdAt})::text`,
        type: inventoryTransactions.transactionType,
        total: sql<number>`sum(${inventoryTransactions.quantity})::int`
      }).from(inventoryTransactions)
      .where(gte(inventoryTransactions.createdAt, startDate))
      .groupBy(sql`DATE(${inventoryTransactions.createdAt})`, inventoryTransactions.transactionType)
      .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);

      if (tenantIdToUse) {
        inventoryQuery = tx.select({
          date: sql<string>`DATE(${inventoryTransactions.createdAt})::text`,
          type: inventoryTransactions.transactionType,
          total: sql<number>`sum(${inventoryTransactions.quantity})::int`
        }).from(inventoryTransactions)
        .where(and(eq(inventoryTransactions.tenantId, tenantIdToUse as number), gte(inventoryTransactions.createdAt, startDate)))
        .groupBy(sql`DATE(${inventoryTransactions.createdAt})`, inventoryTransactions.transactionType)
        .orderBy(sql`DATE(${inventoryTransactions.createdAt})`);
      }

      // 4. Execute all queries in parallel
      const [
        [inventoryStats],
        [deliveryStats],
        [customerStats],
        [driverStats],
        [vehicleStats],
        statusDistributionRaw,
        deliveriesPerDay,
        inventoryMovement
      ] = await Promise.all([
        inventoryStatsQuery,
        deliveryStatsQuery,
        customerStatsQuery,
        driverStatsQuery,
        vehicleStatsQuery,
        statusQuery,
        dailyQuery,
        inventoryQuery
      ]);

      const stats = {
        activeDeliveries: (parseInt((deliveryStats as any).pending_deliveries) || 0) + (parseInt((deliveryStats as any).in_transit_deliveries) || 0),
        completedDeliveries: parseInt((deliveryStats as any).completed_deliveries) || 0,
        lowStockItems: parseInt((inventoryStats as any).low_stock_count) || 0,
        totalProducts: parseInt((inventoryStats as any).total_products) || 0,
        activeCustomers: parseInt((customerStats as any).active_customers) || 0,
        expiringLicenses: parseInt((driverStats as any).expiring_licenses) || 0,
        expiringRegistrations: parseInt((vehicleStats as any).expiring_registrations) || 0
      };

      const statusDistribution = statusDistributionRaw.map((s: any) => ({
        name: s.status,
        value: s.value
      }));

      const chartData = {
        statusDistribution,
        deliveriesPerDay,
        inventoryMovement
      };

      return { stats, chartData };
    });

    return <DashboardClient initialStats={data.stats} initialChartData={data.chartData} currentRange={range} />;
  } catch (error) {
    console.error(error);
    return <div className={styles.error}>Failed to load dashboard data</div>;
  }
}
