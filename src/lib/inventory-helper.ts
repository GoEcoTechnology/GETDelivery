import { products, productVariants, deliveryItems, inventoryTransactions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Deduct stock for all items in a delivery order.
 * Throws an error if any product has insufficient stock.
 */
export async function deductOrderStock(tx: any, tenantId: number, orderId: number, userId: number | null = null) {
  // 1. Fetch all items for the order
  const items = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));
  if (items.length === 0) return;

  const productIds = items.map((item: any) => item.productId);

  // 2. Fetch current productVariants
  const variantList = await tx.select().from(productVariants).where(inArray(productVariants.productId, productIds));
  const variantMap = new Map<number, any>(variantList.map((v: any) => [v.productId, v]));

  // 3. Check stock and prepare updates
  for (const item of items) {
    const variant = variantMap.get(item.productId);
    if (!variant) {
      throw new Error(`Product variant for ${item.productId} not found.`);
    }
    if (variant.stock < item.quantity) {
      throw new Error(`Insufficient stock for product ID: ${item.productId}. Required: ${item.quantity}, Available: ${variant.stock}`);
    }
  }

  // 4. Update stock and create inventory transactions
  for (const item of items) {
    const variant = variantMap.get(item.productId);
    const newStock = variant.stock - item.quantity;

    await tx
      .update(productVariants)
      .set({ stock: newStock })
      .where(eq(productVariants.id, variant.id));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: item.productId,
      variantId: variant.id,
      quantity: item.quantity,
      previousStock: variant.stock,
      newStock: newStock,
      transactionType: 'OUT',
      reference: `Delivery Order SO-000${orderId} dispatched`,
      performedBy: userId
    });
  }
}

/**
 * Revert stock for all items in a delivery order (on cancellation).
 */
export async function revertOrderStock(tx: any, tenantId: number, orderId: number, userId: number | null = null) {
  // 1. Fetch all items for the order
  const items = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));
  if (items.length === 0) return;

  const productIds = items.map((item: any) => item.productId);

  // 2. Fetch current productVariants
  const variantList = await tx.select().from(productVariants).where(inArray(productVariants.productId, productIds));
  const variantMap = new Map<number, any>(variantList.map((v: any) => [v.productId, v]));

  // 3. Update stock and create inventory transactions
  for (const item of items) {
    const variant = variantMap.get(item.productId);
    if (!variant) continue;

    const newStock = variant.stock + item.quantity;

    await tx
      .update(productVariants)
      .set({ stock: newStock })
      .where(eq(productVariants.id, variant.id));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: item.productId,
      variantId: variant.id,
      quantity: item.quantity,
      previousStock: variant.stock,
      newStock: newStock,
      transactionType: 'IN',
      reference: `Delivery Order SO-000${orderId} cancelled`,
      performedBy: userId
    });
  }
}
