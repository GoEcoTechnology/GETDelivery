import { NextResponse } from 'next/server';
import { products, productVariants, inventoryTransactions, stockIns } from '@/db/schema';
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

    // 1. Extract variant IDs and validate
    const variantIds: number[] = [];
    const itemMap = new Map<number, any>();
    
    for (const item of items) {
      if (!item.productId || !item.variantId || !item.quantity || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }
      variantIds.push(item.variantId);
      
      // Merge quantities if the same variant is added multiple times
      if (itemMap.has(item.variantId)) {
        const existing = itemMap.get(item.variantId);
        existing.quantity += item.quantity;
      } else {
        itemMap.set(item.variantId, { ...item });
      }
    }

    // 2. Fetch all product variants and lock rows
    const lockedVariants = await tx
      .select({ 
        id: productVariants.id, 
        productId: productVariants.productId, 
        stock: productVariants.stock,
        price: productVariants.price
      })
      .from(productVariants)
      .where(and(inArray(productVariants.id, variantIds), eq(productVariants.tenantId, tenantIdToUse as number)));

    if (lockedVariants.length === 0) {
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

    // Fetch the most recent stock-in unit costs for these products as fallback
    const productIdsToLookUp = lockedVariants.map((v: any) => v.productId);
    const lastStockInsWithCost = await tx
      .select({ productId: stockIns.productId, unitCost: stockIns.unitCost })
      .from(stockIns)
      .where(and(inArray(stockIns.productId, productIdsToLookUp), eq(stockIns.tenantId, tenantIdToUse as number)))
      .orderBy(desc(stockIns.createdAt));

    const lastCostMap = new Map<number, string>();
    for (const record of lastStockInsWithCost) {
      if (!lastCostMap.has(record.productId) && record.unitCost) {
        lastCostMap.set(record.productId, record.unitCost);
      }
    }

    const results = [];
    const transactionsToInsert = [];
    const stockInsToInsert = [];

    // 3. Process logic and perform individual updates
    for (const variant of lockedVariants) {
      const itemData = itemMap.get(variant.id);
      if (!itemData) continue;
      const quantityToAdd = itemData.quantity;

      const newStock = variant.stock + quantityToAdd;

      await tx
        .update(productVariants)
        .set({ stock: newStock, updatedAt: new Date() })
        .where(eq(productVariants.id, variant.id));

      transactionsToInsert.push({
        tenantId: tenantIdToUse,
        productId: variant.productId,
        variantId: variant.id,
        quantity: quantityToAdd,
        previousStock: variant.stock,
        newStock: newStock,
        transactionType: 'IN',
        reference: generatedReference,
        performedBy: claims.userId,
        createdAt: today
      });

      // If cost is not provided, fallback to the last stock in cost for this product, or the variant's base price.
      const fallbackCost = lastCostMap.get(variant.productId) || (variant.price ? variant.price.toString() : null);

      stockInsToInsert.push({
        tenantId: tenantIdToUse,
        productId: variant.productId,
        quantity: quantityToAdd,
        unitCost: itemData.unitCost ? itemData.unitCost.toString() : fallbackCost,
        supplier: itemData.supplier || null,
        notes: itemData.notes || null,
        referenceNumber: generatedReference,
        performedBy: claims.userId,
        status: 'COMPLETED',
        createdAt: today
      });

      results.push({ productId: variant.productId, newStock, reference: generatedReference });
    }

    // 4. Bulk insert transaction logs
    if (transactionsToInsert.length > 0) {
      await tx.insert(inventoryTransactions).values(transactionsToInsert);
      await tx.insert(stockIns).values(stockInsToInsert);
    }

    return NextResponse.json({ success: true, data: results }, { status: 201 });
  });
}
