import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, inventoryTransactions } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.stock_out'] }, async (tx, claims) => {
    // Robust body parsing: capture raw text and attempt JSON.parse
    const raw = await request.text();
    console.log('stock-out request headers:', {
      hasAuthorization: !!request.headers.get('authorization'),
      userRoleHeader: request.headers.get('x-user-role') || null,
    });
    let parsedBody: any;
    try {
      parsedBody = raw ? JSON.parse(raw) : {};
    } catch (err: any) {
      console.error('Invalid JSON body for stock-out:', raw, err);
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { items, reason, date } = parsedBody;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No items provided' }, { status: 400 });
    }
    if (!reason) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId) as number;
    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant context required' }, { status: 400 });
    }

    // 1. Validate and extract product IDs
    const productIds: number[] = [];
    const itemMap = new Map<number, any>();
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        throw new Error('Invalid item data');
      }
      productIds.push(item.productId);
      
      if (itemMap.has(item.productId)) {
        const existing = itemMap.get(item.productId);
        existing.quantity += item.quantity;
        if (item.notes) existing.notes = item.notes; // Keep the latest note if duplicated
      } else {
        itemMap.set(item.productId, { ...item });
      }
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
    // stockOuts table not present in schema; extra metadata omitted

    // Generate a simple unique reference STO-YYYYMMDD-RAND
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const generatedReference = `STO-${dateStr}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    const transactionDate = date ? new Date(date) : new Date();

    // 3. Process logic and perform individual updates
    for (const product of lockedProducts) {
      const itemData = itemMap.get(product.id);
      const quantityToDeduct = itemData.quantity;

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
        reference: generatedReference,
        performedBy: claims.userId,
        createdAt: transactionDate
      });

      // stock-out metadata omitted (no dedicated table in schema)

      results.push({ productId: product.id, newStock, reference: generatedReference });
    }

    // 4. Bulk insert transaction logs
    if (transactionsToInsert.length > 0) {
      await tx.insert(inventoryTransactions).values(transactionsToInsert);
    }

    return NextResponse.json({ success: true, data: results });
  });
}

