import { db } from '@/db';
import { deliveryOrders, deliveryBatches } from '@/db/schema';
import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';

/**
 * Automatically purges:
 * 1. Cancelled orders older than 1 week (7 days).
 * 2. Completed deliveries (orders and batches) for both delivery partners and business owners older than 1 month (30 days).
 */
export async function purgeExpiredDeliveries(tenantId?: number | null) {
  try {
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

    const cancelledCutoff = new Date(Date.now() - ONE_WEEK_MS);
    const completedCutoff = new Date(Date.now() - ONE_MONTH_MS);

    let purgedCancelledCount = 0;
    let purgedCompletedOrdersCount = 0;
    let purgedCompletedBatchesCount = 0;

    // 1. Purge cancelled orders older than 1 week (7 days)
    const expiredCancelledOrders = await db
      .select({ id: deliveryOrders.id })
      .from(deliveryOrders)
      .where(
        and(
          eq(deliveryOrders.status, 'CANCELLED'),
          or(
            lte(deliveryOrders.cancelledAt, cancelledCutoff),
            and(sql`${deliveryOrders.cancelledAt} IS NULL`, lte(deliveryOrders.createdAt, cancelledCutoff))
          ),
          tenantId ? eq(deliveryOrders.tenantId, tenantId) : undefined
        )
      );

    const cancelledOrderIds = expiredCancelledOrders.map(o => o.id);
    if (cancelledOrderIds.length > 0) {
      await db
        .delete(deliveryOrders)
        .where(inArray(deliveryOrders.id, cancelledOrderIds));
      purgedCancelledCount = cancelledOrderIds.length;
    }

    // 2. Purge completed orders older than 1 month (30 days) for both delivery partners and business owners
    const expiredCompletedOrders = await db
      .select({ id: deliveryOrders.id })
      .from(deliveryOrders)
      .where(
        and(
          inArray(deliveryOrders.status, ['DELIVERED', 'COMPLETED']),
          or(
            lte(deliveryOrders.completedAt, completedCutoff),
            and(sql`${deliveryOrders.completedAt} IS NULL`, lte(deliveryOrders.createdAt, completedCutoff))
          ),
          tenantId ? eq(deliveryOrders.tenantId, tenantId) : undefined
        )
      );

    const completedOrderIds = expiredCompletedOrders.map(o => o.id);
    if (completedOrderIds.length > 0) {
      await db
        .delete(deliveryOrders)
        .where(inArray(deliveryOrders.id, completedOrderIds));
      purgedCompletedOrdersCount = completedOrderIds.length;
    }

    // 3. Purge completed delivery batches older than 1 month (30 days)
    const expiredCompletedBatches = await db
      .select({ id: deliveryBatches.id })
      .from(deliveryBatches)
      .where(
        and(
          inArray(deliveryBatches.status, ['DELIVERED', 'COMPLETED']),
          lte(deliveryBatches.createdAt, completedCutoff),
          tenantId ? eq(deliveryBatches.tenantId, tenantId) : undefined
        )
      );

    const completedBatchIds = expiredCompletedBatches.map(b => b.id);
    if (completedBatchIds.length > 0) {
      await db
        .delete(deliveryBatches)
        .where(inArray(deliveryBatches.id, completedBatchIds));
      purgedCompletedBatchesCount = completedBatchIds.length;
    }

    return {
      success: true,
      cancelledCutoff,
      completedCutoff,
      purgedCancelledCount,
      purgedCompletedOrdersCount,
      purgedCompletedBatchesCount,
    };
  } catch (error) {
    console.error('Error in purgeExpiredDeliveries:', error);
    return {
      success: false,
      error: String(error),
      purgedCancelledCount: 0,
      purgedCompletedOrdersCount: 0,
      purgedCompletedBatchesCount: 0,
    };
  }
}

// Backward-compatible alias
export const purgeExpiredCompletedDeliveries = purgeExpiredDeliveries;
