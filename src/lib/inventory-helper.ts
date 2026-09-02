import { products, deliveryItems, inventoryTransactions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';

/**
 * Deduct stock for all items in a delivery order.
 * Throws an error if any product has insufficient stock.
 */
export async function deductOrderStock(tx: any, tenantId: number, orderId: number, userId: number | null = null) {
  // 1. Fetch all items for the order
  const items = await tx.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));
  if (items.length === 0) return;

  const productIds = items.map((item: any) => item.productId);

  // 2. Fetch current products
  const productList = await tx.select().from(products).where(inArray(products.id, productIds));
  const productMap = new Map<number, any>(productList.map((p: any) => [p.id, p]));

  // 3. Check stock and prepare updates
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) {
      throw new Error(`Product ${item.productId} not found.`);
    }
    if (product.stock < item.quantity) {
      throw new Error(`Insufficient stock for product: ${product.name}. Required: ${item.quantity}, Available: ${product.stock}`);
    }
  }

  // 4. Update stock and create inventory transactions
  for (const item of items) {
    const product = productMap.get(item.productId);
    const newStock = product.stock - item.quantity;

    await tx
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, product.id));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: product.id,
      quantity: item.quantity,
      previousStock: product.stock,
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

  // 2. Fetch current products
  const productList = await tx.select().from(products).where(inArray(products.id, productIds));
  const productMap = new Map<number, any>(productList.map((p: any) => [p.id, p]));

  // 3. Update stock and create inventory transactions
  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const newStock = product.stock + item.quantity;

    await tx
      .update(products)
      .set({ stock: newStock })
      .where(eq(products.id, product.id));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: product.id,
      quantity: item.quantity,
      previousStock: product.stock,
      newStock: newStock,
      transactionType: 'IN',
      reference: `Delivery Order SO-000${orderId} cancelled`,
      performedBy: userId
    });
  }
}
