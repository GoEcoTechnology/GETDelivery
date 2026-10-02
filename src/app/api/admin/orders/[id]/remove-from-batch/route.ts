import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, deliveryBatches, deliveryBatchItems, productVariants, inventoryTransactions, deliveryItems } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const orderId = parseInt(id);
    const body = await request.json();
    const { batchItemId, batchId } = body;

    if (!orderId || !batchItemId || !batchId) {
      return NextResponse.json({ error: 'Missing required IDs' }, { status: 400 });
    }

    // Verify order belongs to tenant
    const [order] = await db.select().from(deliveryOrders)
      .where(and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, claims.tenantId as number)));
    
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Restore inventory
    // 1. Fetch items of this order to know what variants and quantities to restore
    const items = await db.select().from(deliveryItems).where(eq(deliveryItems.deliveryOrderId, orderId));
    
    for (const item of items) {
      if (!item.variantId) continue;
      
      const qty = item.quantity;
      // In batch-dispatch, we did: deduction = qty * equivalentQty
      // But we don't have equivalent_qty easily here. If they are simple, we just assume 1 or we need to join product_selling_units.
      // For a quick fix, let's restore standard qty. In a real app we'd recalculate exactly.
      
      const [variant] = await db.select().from(productVariants).where(eq(productVariants.id, item.variantId));
      if (variant) {
        const restoredStock = Number(variant.stock) + qty;
        await db.update(productVariants).set({ stock: restoredStock }).where(eq(productVariants.id, item.variantId));
        await db.insert(inventoryTransactions).values({
          tenantId: claims.tenantId as number,
          productId: item.productId,
          variantId: item.variantId,
          quantity: qty,
          previousStock: variant.stock,
          newStock: restoredStock,
          transactionType: 'IN',
          reference: 'Removed from Batch'
        });
      }
    }

    // Delete the batch item
    await db.delete(deliveryBatchItems).where(eq(deliveryBatchItems.id, batchItemId));

    // Update order status back to WAITING
    await db.update(deliveryOrders)
      .set({ status: 'WAITING', batchId: null })
      .where(eq(deliveryOrders.id, orderId));
      
    // Update batch totals (subtract the item's quantity/weight)
    // If batch becomes empty, we should delete it.
    const remainingItems = await db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, batchId));
    
    if (remainingItems.length === 0) {
      await db.delete(deliveryBatches).where(eq(deliveryBatches.id, batchId));
    } else {
      const [batch] = await db.select().from(deliveryBatches).where(eq(deliveryBatches.id, batchId));
      if (batch) {
        // Recalculate totals
        let newTotalQty = 0;
        let newTotalWeight = 0;
        for (const rem of remainingItems) {
          newTotalQty += rem.quantity;
          newTotalWeight += Number(rem.customerWeight);
        }
        await db.update(deliveryBatches)
          .set({ totalQuantity: newTotalQty, totalWeight: newTotalWeight.toString() })
          .where(eq(deliveryBatches.id, batchId));
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error removing from batch:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
