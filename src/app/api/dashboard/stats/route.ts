import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, deliveryOrders, customers, drivers, vehicles } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(req: Request) {
  return withAuth(req, async (tx, claims) => {
    try {
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    const tenantCondition = tenantIdToUse ? sql`tenant_id = ${tenantIdToUse}` : sql`1=1`;

    const inventoryStatsQuery = db.execute(sql`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(stock) as total_units_in_stock
      FROM ${products}
      WHERE ${tenantCondition}
    `);

    const deliveryStatsQuery = db.execute(sql`
      SELECT 
        COUNT(id) as total_deliveries,
        SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
      FROM ${deliveryOrders}
      WHERE ${tenantCondition}
    `);

    const customerStatsQuery = db.execute(sql`
      SELECT COUNT(id) as active_customers
      FROM ${customers}
      WHERE ${tenantCondition} AND status = 'ACTIVE'
    `);

    const driverStatsQuery = db.execute(sql`
      SELECT COUNT(id) as expiring_licenses
      FROM ${drivers}
      WHERE ${tenantCondition} AND (license_expiry <= NOW() + INTERVAL '30 days' OR license_expiry IS NULL)
    `);

    const vehicleStatsQuery = db.execute(sql`
      SELECT COUNT(id) as expiring_registrations
      FROM ${vehicles}
      WHERE ${tenantCondition} AND (registration_expiry <= NOW() + INTERVAL '30 days' OR registration_expiry IS NULL)
    `);

    const [
      [inventoryStats],
      [deliveryStats],
      [customerStats],
      [driverStats],
      [vehicleStats]
    ] = await Promise.all([
      inventoryStatsQuery,
      deliveryStatsQuery,
      customerStatsQuery,
      driverStatsQuery,
      vehicleStatsQuery
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

    return NextResponse.json(stats);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
    }
  });
}
