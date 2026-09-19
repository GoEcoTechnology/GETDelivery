import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, deliveryOrders, customers, drivers, vehicles } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(req: Request) {
  return withAuth(req, async (tx, claims) => {
    try {
      const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
      const tenantFilter = tenantIdToUse ? sql`tenant_id = ${tenantIdToUse}` : sql`1=1`;

      const hasLowStockColumnResult = await db.execute(sql`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'products'
            AND column_name = 'low_stock_threshold'
        ) AS has_low_stock_column
      `);
      const hasLowStockColumn = Boolean((Array.isArray(hasLowStockColumnResult) ? hasLowStockColumnResult[0] : (hasLowStockColumnResult as any)?.[0])?.has_low_stock_column);

      const inventoryStatsQuery = hasLowStockColumn
        ? db.execute(sql`
            SELECT 
              COUNT(id) as total_products,
              SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
              SUM(stock) as total_units_in_stock
            FROM ${products}
            WHERE ${tenantFilter}
          `)
        : db.execute(sql`
            SELECT 
              COUNT(id) as total_products,
              0 as low_stock_count,
              0 as total_units_in_stock
            FROM ${products}
            WHERE ${tenantFilter}
          `);

      const deliveryStatsQuery = db.execute(sql`
        SELECT 
          COUNT(id) as total_deliveries,
          SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
          SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
          SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
        FROM ${deliveryOrders}
        WHERE ${tenantFilter}
      `);

      const customerStatsQuery = db.execute(sql`
        SELECT COUNT(id) as active_customers
        FROM ${customers}
        WHERE ${tenantFilter} AND status = 'ACTIVE'
      `);

      const driverStatsQuery = db.execute(sql`
        SELECT COUNT(id) as expiring_licenses
        FROM ${drivers}
        WHERE ${tenantFilter} AND (license_expiry <= NOW() + INTERVAL '30 days' OR license_expiry IS NULL)
      `);

      const vehicleStatsQuery = db.execute(sql`
        SELECT COUNT(id) as expiring_registrations
        FROM ${vehicles}
        WHERE ${tenantFilter} AND (registration_expiry <= NOW() + INTERVAL '30 days' OR registration_expiry IS NULL)
      `);

      const [
        inventoryStatsResult,
        deliveryStatsResult,
        customerStatsResult,
        driverStatsResult,
        vehicleStatsResult
      ] = await Promise.all([
        inventoryStatsQuery,
        deliveryStatsQuery,
        customerStatsQuery,
        driverStatsQuery,
        vehicleStatsQuery
      ]);

      const inventoryStats = (Array.isArray(inventoryStatsResult) ? inventoryStatsResult[0] : inventoryStatsResult?.[0]) || {};
      const deliveryStats = (Array.isArray(deliveryStatsResult) ? deliveryStatsResult[0] : deliveryStatsResult?.[0]) || {};
      const customerStats = (Array.isArray(customerStatsResult) ? customerStatsResult[0] : customerStatsResult?.[0]) || {};
      const driverStats = (Array.isArray(driverStatsResult) ? driverStatsResult[0] : driverStatsResult?.[0]) || {};
      const vehicleStats = (Array.isArray(vehicleStatsResult) ? vehicleStatsResult[0] : vehicleStatsResult?.[0]) || {};

      const deliveryRow = (deliveryStats as Record<string, unknown>) || {};
      const inventoryRow = (inventoryStats as Record<string, unknown>) || {};
      const customerRow = (customerStats as Record<string, unknown>) || {};
      const driverRow = (driverStats as Record<string, unknown>) || {};
      const vehicleRow = (vehicleStats as Record<string, unknown>) || {};

      const stats = {
        activeDeliveries: (parseInt(String(deliveryRow.pending_deliveries ?? 0)) || 0) + (parseInt(String(deliveryRow.in_transit_deliveries ?? 0)) || 0),
        completedDeliveries: parseInt(String(deliveryRow.completed_deliveries ?? 0)) || 0,
        lowStockItems: parseInt(String(inventoryRow.low_stock_count ?? 0)) || 0,
        totalProducts: parseInt(String(inventoryRow.total_products ?? 0)) || 0,
        activeCustomers: parseInt(String(customerRow.active_customers ?? 0)) || 0,
        expiringLicenses: parseInt(String(driverRow.expiring_licenses ?? 0)) || 0,
        expiringRegistrations: parseInt(String(vehicleRow.expiring_registrations ?? 0)) || 0
      };

      return NextResponse.json(stats);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
  });
}
