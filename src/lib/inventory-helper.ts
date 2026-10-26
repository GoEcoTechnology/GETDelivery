import { products, productVariants, productSellingUnits, deliveryItems, deliveryOrders, inventoryTransactions } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';

/**
 * Deduct stock for all items in a delivery order, including any sub-orders attached to it.
 * Multiplies by selling unit equivalent quantities if specified.
 * Throws an error if any product has insufficient stock.
 */
export async function deductOrderStock(tx: any, tenantId: number, orderId: number, userId: number | null = null) {
  // 1. Fetch the order and any sub-orders (for batch/quota deliveries with added customers)
  const subOrders = await tx
    .select({ id: deliveryOrders.id })
    .from(deliveryOrders)
    .where(eq(deliveryOrders.parentOrderId, orderId));

  const allOrderIds = [orderId, ...subOrders.map((s: any) => s.id)];

  // 2. Fetch all items for this order and all its sub-orders
  const rawItems = await tx
    .select()
    .from(deliveryItems)
    .where(inArray(deliveryItems.deliveryOrderId, allOrderIds));

  // Only consider items with quantity > 0 (filters out 0-quantity placeholders)
  const items = rawItems.filter((item: any) => Number(item.quantity) > 0);
  if (items.length === 0) return;

  const productIds = Array.from(new Set(items.map((item: any) => item.productId))) as number[];

  // 3. Fetch variants and selling units
  const [variantList, sellingUnitList] = await Promise.all([
    tx.select().from(productVariants).where(inArray(productVariants.productId, productIds)),
    tx.select().from(productSellingUnits).where(inArray(productSellingUnits.productId, productIds)),
  ]);

  const variantById = new Map<number, any>(variantList.map((v: any) => [v.id, v]));
  const defaultVariantByProduct = new Map<number, any>();
  for (const v of variantList) {
    if (!defaultVariantByProduct.has(v.productId)) {
      defaultVariantByProduct.set(v.productId, v);
    }
  }

  // 4. Group deductions by target variant ID
  const deductionsByVariant = new Map<number, {
    variant: any;
    productId: number;
    totalDeduction: number;
  }>();

  for (const item of items) {
    const targetVariant = item.variantId ? variantById.get(item.variantId) : defaultVariantByProduct.get(item.productId);
    if (!targetVariant) {
      throw new Error(`Product variant for product ID ${item.productId} not found.`);
    }

    let equivMultiplier = 1;
    if (item.unit) {
      const matchSU = sellingUnitList.find((su: any) =>
        su.productId === item.productId &&
        (su.variantId === targetVariant.id || !su.variantId) &&
        su.unitName?.trim().toLowerCase() === item.unit.trim().toLowerCase()
      );
      if (matchSU?.equivalentQty) {
        equivMultiplier = Number(matchSU.equivalentQty) || 1;
      }
    }

    const deduction = Math.round(Number(item.quantity) * equivMultiplier);
    if (deduction <= 0) continue;

    const existing = deductionsByVariant.get(targetVariant.id);
    if (existing) {
      existing.totalDeduction += deduction;
    } else {
      deductionsByVariant.set(targetVariant.id, {
        variant: targetVariant,
        productId: item.productId,
        totalDeduction: deduction,
      });
    }
  }

  // 5. Verify sufficient stock
  for (const [vId, record] of deductionsByVariant.entries()) {
    if (record.variant.stock < record.totalDeduction) {
      throw new Error(
        `Insufficient stock for product ID: ${record.productId} (${record.variant.name || 'Variant'}). Required: ${record.totalDeduction}, Available: ${record.variant.stock}`
      );
    }
  }

  // 6. Update stock and insert inventory transactions
  for (const [vId, record] of deductionsByVariant.entries()) {
    const newStock = record.variant.stock - record.totalDeduction;

    await tx
      .update(productVariants)
      .set({ stock: newStock })
      .where(eq(productVariants.id, vId));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: record.productId,
      variantId: vId,
      quantity: record.totalDeduction,
      previousStock: record.variant.stock,
      newStock: newStock,
      transactionType: 'OUT',
      reference: `Delivery Order SO-000${orderId}`,
      performedBy: userId,
    });
  }
}

/**
 * Revert stock for all items in a delivery order (on cancellation).
 */
export async function revertOrderStock(tx: any, tenantId: number, orderId: number, userId: number | null = null) {
  // 1. Fetch the order and any sub-orders
  const subOrders = await tx
    .select({ id: deliveryOrders.id })
    .from(deliveryOrders)
    .where(eq(deliveryOrders.parentOrderId, orderId));

  const allOrderIds = [orderId, ...subOrders.map((s: any) => s.id)];

  // 2. Fetch all items
  const rawItems = await tx
    .select()
    .from(deliveryItems)
    .where(inArray(deliveryItems.deliveryOrderId, allOrderIds));

  const items = rawItems.filter((item: any) => Number(item.quantity) > 0);
  if (items.length === 0) return;

  const productIds = Array.from(new Set(items.map((item: any) => item.productId))) as number[];

  // 3. Fetch variants and selling units
  const [variantList, sellingUnitList] = await Promise.all([
    tx.select().from(productVariants).where(inArray(productVariants.productId, productIds)),
    tx.select().from(productSellingUnits).where(inArray(productSellingUnits.productId, productIds)),
  ]);

  const variantById = new Map<number, any>(variantList.map((v: any) => [v.id, v]));
  const defaultVariantByProduct = new Map<number, any>();
  for (const v of variantList) {
    if (!defaultVariantByProduct.has(v.productId)) {
      defaultVariantByProduct.set(v.productId, v);
    }
  }

  // 4. Group additions by target variant ID
  const additionsByVariant = new Map<number, {
    variant: any;
    productId: number;
    totalAddition: number;
  }>();

  for (const item of items) {
    const targetVariant = item.variantId ? variantById.get(item.variantId) : defaultVariantByProduct.get(item.productId);
    if (!targetVariant) continue;

    let equivMultiplier = 1;
    if (item.unit) {
      const matchSU = sellingUnitList.find((su: any) =>
        su.productId === item.productId &&
        (su.variantId === targetVariant.id || !su.variantId) &&
        su.unitName?.trim().toLowerCase() === item.unit.trim().toLowerCase()
      );
      if (matchSU?.equivalentQty) {
        equivMultiplier = Number(matchSU.equivalentQty) || 1;
      }
    }

    const addition = Math.round(Number(item.quantity) * equivMultiplier);
    if (addition <= 0) continue;

    const existing = additionsByVariant.get(targetVariant.id);
    if (existing) {
      existing.totalAddition += addition;
    } else {
      additionsByVariant.set(targetVariant.id, {
        variant: targetVariant,
        productId: item.productId,
        totalAddition: addition,
      });
    }
  }

  // 5. Update stock and create inventory transactions
  for (const [vId, record] of additionsByVariant.entries()) {
    const newStock = record.variant.stock + record.totalAddition;

    await tx
      .update(productVariants)
      .set({ stock: newStock })
      .where(eq(productVariants.id, vId));

    await tx.insert(inventoryTransactions).values({
      tenantId,
      productId: record.productId,
      variantId: vId,
      quantity: record.totalAddition,
      previousStock: record.variant.stock,
      newStock: newStock,
      transactionType: 'IN',
      reference: `Delivery Order SO-000${orderId} cancelled`,
      performedBy: userId,
    });
  }
}

