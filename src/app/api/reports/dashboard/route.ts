import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, deliveryOrders, tenants, deliveryPartners } from '@/db/schema';
import { eq, sql, and, count } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view', 'delivery.view'] }, async (tx, claims) => {
    
    // Calculate global stats using efficient SQL aggregations
    // We do NOT use SELECT * to avoid fetching heavy text fields

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    
    const tenantCondition = tenantIdToUse 
      ? sql`tenant_id = ${tenantIdToUse}` 
      : sql`1=1`;

    // 1. Get Inventory summary (Total products, Low stock count)
    const [inventoryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_products,
        SUM(CASE WHEN stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_count,
        SUM(stock) as total_units_in_stock
      FROM ${products}
      WHERE ${tenantCondition}
    `);

    // 2. Get Delivery summary (Total today, pending, completed)
    const [deliveryStats] = await tx.execute(sql`
      SELECT 
        COUNT(id) as total_deliveries,
        SUM(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 ELSE 0 END) as pending_deliveries,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        SUM(CASE WHEN status = 'IN_TRANSIT' THEN 1 ELSE 0 END) as in_transit_deliveries
      FROM ${deliveryOrders}
      WHERE ${tenantCondition}
    `);

    // 3. Get recent low stock items (Limit 5)
    const lowStockItems = await tx
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(
        tenantIdToUse 
          ? and(eq(products.tenantId, tenantIdToUse as number), sql`stock <= low_stock_threshold`) 
          : sql`stock <= low_stock_threshold`
      )
      .limit(5);

    const response = {
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

    if (claims.role === 'PLATFORM_OWNER') {
      const [platformStats] = await tx.execute(sql`
        SELECT 
          (SELECT COUNT(*) FROM ${tenants}) as total_tenants,
          (SELECT COUNT(*) FROM ${deliveryPartners}) as total_partners
      `);
      (response as any).platform = {
        totalTenants: parseInt((platformStats as any).total_tenants) || 0,
        totalPartners: parseInt((platformStats as any).total_partners) || 0
      };
    }

    return NextResponse.json(response);
  }).catch((error: any) => {
    return NextResponse.json({ error: error.message }, { status: 500 });
  });
}
