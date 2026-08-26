import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, inventoryTransactions } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.stock_in'] }, async (tx, claims) => {
    const { productId, quantity, reference, remarks } = await request.json();

    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json({ error: 'Valid product ID and quantity > 0 are required' }, { status: 400 });
    }

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;

    return await tx.transaction(async (innerTx: any) => {
      // 1. Fetch product and lock row
      const result = await innerTx.execute(sql`
        SELECT id, stock, tenant_id FROM ${products} 
        WHERE id = ${productId}
        ${tenantIdToUse ? sql`AND tenant_id = ${tenantIdToUse}` : sql``}
        FOR UPDATE
      `);

      const product = result[0] as any;

      if (!product) {
        throw new Error('Product not found or access denied');
      }

      const newStock = product.stock + quantity;

      // 2. Update stock
      await innerTx
        .update(products)
        .set({ stock: newStock })
        .where(eq(products.id, productId));

      // 3. Log transaction
      await innerTx.insert(inventoryTransactions).values({
        tenantId: product.tenant_id,
        productId,
        quantity,
        previousStock: product.stock,
        newStock,
        transactionType: 'IN',
        reference: reference || 'MANUAL_STOCK_IN',
        remarks,
      });

      return NextResponse.json({ success: true, newStock });
    });
  }).catch((error: any) => {
    console.error('Stock in error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  });
}
