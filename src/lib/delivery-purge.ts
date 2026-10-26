import { db } from '@/db';
import {
  deliveryOrders,
  deliveryBatches,
  auditLogs,
  deliveryInvitations,
  notifications,
  inventoryTransactions,
  stockIns,
  stockOuts
} from '@/db/schema';
import { and, eq, inArray, lte, or, sql } from 'drizzle-orm';

/**
 * Automatically purges old records:
 * 1. Cancelled orders older than 1 month (30 days).
 * 2. Completed deliveries (orders and batches) for both delivery partners and business owners older than 1 month (30 days).
 * 3. Audit logs older than 1 month (30 days).
 * 4. Expired or declined delivery invitations older than 1 month (30 days).
 * 5. Read notifications older than 2 weeks (14 days).
 * 6. Inventory transactions & stock history older than 1 month (30 days).
 */
export async function purgeExpiredDeliveries(tenantId?: number | null) {
  try {
    const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - ONE_MONTH_MS);
    const notificationsCutoff = new Date(Date.now() - TWO_WEEKS_MS);

    let purgedCancelledCount = 0;
    let purgedCompletedOrdersCount = 0;
    let purgedCompletedBatchesCount = 0;
    let purgedAuditLogsCount = 0;
    let purgedInvitationsCount = 0;
    let purgedNotificationsCount = 0;
    let purgedInventoryTransactionsCount = 0;

    // 1. Purge cancelled orders older than 1 month (30 days)
    const expiredCancelledOrders = await db
      .select({ id: deliveryOrders.id })
      .from(deliveryOrders)
      .where(
        and(
          eq(deliveryOrders.status, 'CANCELLED'),
          or(
            lte(deliveryOrders.cancelledAt, cutoffDate),
            and(sql`${deliveryOrders.cancelledAt} IS NULL`, lte(deliveryOrders.createdAt, cutoffDate))
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
            lte(deliveryOrders.completedAt, cutoffDate),
            and(sql`${deliveryOrders.completedAt} IS NULL`, lte(deliveryOrders.createdAt, cutoffDate))
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
          lte(deliveryBatches.createdAt, cutoffDate),
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

    // 4. Purge audit logs older than 1 month (30 days)
    const expiredAuditLogs = await db
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          lte(auditLogs.createdAt, cutoffDate),
          tenantId ? eq(auditLogs.tenantId, tenantId) : undefined
        )
      );

    const expiredAuditLogIds = expiredAuditLogs.map(a => a.id);
    if (expiredAuditLogIds.length > 0) {
      await db
        .delete(auditLogs)
        .where(inArray(auditLogs.id, expiredAuditLogIds));
      purgedAuditLogsCount = expiredAuditLogIds.length;
    }

    // 5. Purge expired/declined delivery invitations older than 1 month (30 days)
    const expiredInvitations = await db
      .select({ id: deliveryInvitations.id })
      .from(deliveryInvitations)
      .where(
        and(
          inArray(deliveryInvitations.status, ['EXPIRED', 'DECLINED']),
          lte(deliveryInvitations.createdAt, cutoffDate),
          tenantId ? eq(deliveryInvitations.tenantId, tenantId) : undefined
        )
      );

    const expiredInvitationIds = expiredInvitations.map(i => i.id);
    if (expiredInvitationIds.length > 0) {
      await db
        .delete(deliveryInvitations)
        .where(inArray(deliveryInvitations.id, expiredInvitationIds));
      purgedInvitationsCount = expiredInvitationIds.length;
    }

    // 6. Purge read notifications older than 2 weeks (14 days)
    const expiredNotifs = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.status, 'READ'),
          lte(notifications.createdAt, notificationsCutoff),
          tenantId ? eq(notifications.tenantId, tenantId) : undefined
        )
      );

    const expiredNotifIds = expiredNotifs.map(n => n.id);
    if (expiredNotifIds.length > 0) {
      await db
        .delete(notifications)
        .where(inArray(notifications.id, expiredNotifIds));
      purgedNotificationsCount = expiredNotifIds.length;
    }

    // 7. Purge inventory transactions older than 1 month (30 days)
    const expiredInvTrans = await db
      .select({ id: inventoryTransactions.id })
      .from(inventoryTransactions)
      .where(
        and(
          lte(inventoryTransactions.createdAt, cutoffDate),
          tenantId ? eq(inventoryTransactions.tenantId, tenantId) : undefined
        )
      );

    const expiredInvTransIds = expiredInvTrans.map(t => t.id);
    if (expiredInvTransIds.length > 0) {
      await db
        .delete(inventoryTransactions)
        .where(inArray(inventoryTransactions.id, expiredInvTransIds));
      purgedInventoryTransactionsCount = expiredInvTransIds.length;
    }

    // 8. Purge old stock_ins and stock_outs older than 1 month (30 days)
    await db
      .delete(stockIns)
      .where(
        and(
          lte(stockIns.createdAt, cutoffDate),
          tenantId ? eq(stockIns.tenantId, tenantId) : undefined
        )
      )
      .catch(() => {});

    await db
      .delete(stockOuts)
      .where(
        and(
          lte(stockOuts.createdAt, cutoffDate),
          tenantId ? eq(stockOuts.tenantId, tenantId) : undefined
        )
      )
      .catch(() => {});

    return {
      success: true,
      cutoffDate,
      purgedCancelledCount,
      purgedCompletedOrdersCount,
      purgedCompletedBatchesCount,
      purgedAuditLogsCount,
      purgedInvitationsCount,
      purgedNotificationsCount,
      purgedInventoryTransactionsCount,
    };
  } catch (error) {
    console.error('Error in purgeExpiredDeliveries:', error);
    return {
      success: false,
      error: String(error),
      purgedCancelledCount: 0,
      purgedCompletedOrdersCount: 0,
      purgedCompletedBatchesCount: 0,
      purgedAuditLogsCount: 0,
      purgedInvitationsCount: 0,
      purgedNotificationsCount: 0,
    };
  }
}

// Backward-compatible alias
export const purgeExpiredCompletedDeliveries = purgeExpiredDeliveries;
