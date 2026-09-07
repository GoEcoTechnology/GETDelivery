import { NextResponse } from 'next/server';
import { products, inventoryTransactions, stockIns } from '@/db/schema';
import { eq, inArray, desc, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.stock_in'] }, async (tx, claims) => {
    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId) as number;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    const body = await request.json();
    const { items } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }

    // 1. Extract product IDs and validate
    const productIds: number[] = [];
    const itemMap = new Map<number, any>();
    
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }
      productIds.push(item.productId);
      
      // Merge quantities if the same product is added multiple times
      if (itemMap.has(item.productId)) {
        const existing = itemMap.get(item.productId);
        existing.quantity += item.quantity;
      } else {
        itemMap.set(item.productId, { ...item });
      }
    }

    // 2. Fetch all products and lock rows
    const lockedProducts = await tx
      .select({ id: products.id, stock: products.stock })
      .from(products)
      .where(and(inArray(products.id, productIds), eq(products.tenantId, tenantIdToUse as number)));

    if (lockedProducts.length !== itemMap.size) {
      return NextResponse.json({ error: 'One or more products not found or belong to a different tenant' }, { status: 400 });
    }

    // Generate a unique reference number STIN-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    const lastStockIn = await tx
      .select({ referenceNumber: stockIns.referenceNumber })
      .from(stockIns)
      .where(eq(stockIns.tenantId, tenantIdToUse as number))
      .orderBy(desc(stockIns.id))
      .limit(1);

    let nextNum = 1;
    if (lastStockIn.length > 0 && lastStockIn[0].referenceNumber) {
      const match = lastStockIn[0].referenceNumber.match(/STIN-\d{8}-(\d{4})/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    const generatedReference = `STIN-${dateStr}-${nextNum.toString().padStart(4, '0')}`;

    const results = [];
    const transactionsToInsert = [];
    const stockInsToInsert = [];

    // 3. Process logic and perform individual updates
    for (const product of lockedProducts) {
      const itemData = itemMap.get(product.id);
      const quantityToAdd = itemData.quantity;

      const newStock = product.stock + quantityToAdd;

      await tx
        .update(products)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(products.id, product.id));

      transactionsToInsert.push({
        tenantId: tenantIdToUse,
        productId: product.id,
        quantity: quantityToAdd,
        previousStock: product.stock,
        newStock: newStock,
        transactionType: 'IN',
        reference: generatedReference,
        performedBy: claims.userId,
        createdAt: today
      });

      stockInsToInsert.push({
        tenantId: tenantIdToUse,
        productId: product.id,
        quantity: quantityToAdd,
        unitCost: itemData.unitCost ? itemData.unitCost.toString() : null,
        supplier: itemData.supplier || null,
        notes: itemData.notes || null,
        referenceNumber: generatedReference,
        performedBy: claims.userId,
        status: 'COMPLETED',
        createdAt: today
      });

      results.push({ productId: product.id, newStock, reference: generatedReference });
    }

    // 4. Bulk insert transaction logs
    if (transactionsToInsert.length > 0) {
      await tx.insert(inventoryTransactions).values(transactionsToInsert);
      await tx.insert(stockIns).values(stockInsToInsert);
    }

    return NextResponse.json({ success: true, data: results }, { status: 201 });
  });
}
