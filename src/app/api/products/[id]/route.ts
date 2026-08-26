import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['inventory.update'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();
    const { name, sku, barcode, category, unit, price, lowStockThreshold, productType, status } = body;

    let condition = eq(products.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(products.tenantId, claims.tenantId as number)) as any;
    }

    const [updatedProduct] = await tx.update(products)
      .set({
        name,
        sku,
        barcode,
        category,
        unit,
        price: price ? price.toString() : null,
        lowStockThreshold,
        productType,
        status,
        updatedAt: new Date()
      })
      .where(condition)
      .returning();

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ data: updatedProduct });
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['inventory.update'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    let condition = eq(products.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(products.tenantId, claims.tenantId as number)) as any;
    }

    // We do a soft delete or hard delete. Hard delete for now, but production often uses soft delete.
    const [deleted] = await tx.delete(products).where(condition).returning();

    if (!deleted) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: deleted });
  });
}
