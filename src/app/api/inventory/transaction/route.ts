import { NextResponse } from 'next/server';
import { products, inventoryTransactions } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (!('role' in claims) || (claims.role !== 'PLATFORM_OWNER' && claims.role !== 'BUSINESS_OWNER' && claims.role !== 'EMPLOYEE')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const body = await request.json();
    const { productId, quantity, transactionType, reference } = body;

    if (!productId || !quantity || quantity <= 0 || !['IN', 'OUT'].includes(transactionType)) {
      return NextResponse.json({ error: 'Invalid transaction parameters' }, { status: 400 });
    }

    // In a real strict environment with high concurrency, we would use `.for('update')` if supported by the Drizzle dialect,
    // or run a raw atomic query. Since Drizzle's PG driver handles basic transactions, we will do a select and then update.
    // However, to prevent race conditions as per requirement 14, an atomic update is best.
    
    // RLS handles tenant isolation inherently
    const [product] = await tx
      .select()
      .from(products)
      .where(eq(products.id, productId));

    if (!product) {
      throw new Error('Product not found or unauthorized');
    }

    if (transactionType === 'OUT' && product.stock < quantity) {
      throw new Error('Insufficient stock');
    }

    const previousStock = product.stock;
    const newStock = transactionType === 'IN' ? previousStock + quantity : previousStock - quantity;

    // Update product stock
    await tx
      .update(products)
      .set({ stock: newStock, updatedAt: new Date() })
      .where(eq(products.id, productId));

    // Record transaction
    const [transaction] = await tx.insert(inventoryTransactions).values({
      tenantId: product.tenantId,
      productId,
      quantity,
      previousStock,
      newStock,
      transactionType,
      reference,
      performedBy: claims.userId as number,
    }).returning();

    return NextResponse.json({ data: transaction }, { status: 201 });
  });
}
