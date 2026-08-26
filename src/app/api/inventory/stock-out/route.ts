import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, inventoryTransactions } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.stock_out'] }, async (tx, claims) => {
    const { items, reference } = await request.json();

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // 1. Validate and extract product IDs
    const productIds: number[] = [];
    const itemMap = new Map<number, number>();
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }
      productIds.push(item.productId);
      itemMap.set(item.productId, (itemMap.get(item.productId) || 0) + item.quantity);
    }

    // 2. Fetch all products and lock rows
    const lockedProducts = await tx
      .select({
        id: products.id,
        name: products.name,
        stock: products.stock,
      })
      .from(products)
      .where(
        and(
          inArray(products.id, productIds),
          eq(products.tenantId, tenantIdToUse as number)
        )
      )
      .for('update');

    if (lockedProducts.length !== itemMap.size) {
      throw new Error('One or more products not found');
    }

    const results = [];
    const transactionsToInsert = [];

    // 3. Process logic and perform individual updates
    for (const product of lockedProducts) {
      const quantityToDeduct = itemMap.get(product.id) || 0;

      if (product.stock < quantityToDeduct) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }

      const newStock = product.stock - quantityToDeduct;

      await tx
        .update(products)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(products.id, product.id));

      transactionsToInsert.push({
        tenantId: tenantIdToUse,
        productId: product.id,
        quantity: quantityToDeduct,
        previousStock: product.stock,
        newStock: newStock,
        transactionType: 'OUT',
        reference: reference || 'Manual Stock Out',
        performedBy: claims.userId
      });

      results.push({ productId: product.id, newStock });
    }

    // 4. Bulk insert transaction logs
    if (transactionsToInsert.length > 0) {
      await tx.insert(inventoryTransactions).values(transactionsToInsert);
    }

    return NextResponse.json({ success: true, data: results });
  });
}

