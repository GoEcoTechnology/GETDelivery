import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productVariants, tenants, productSellingUnits } from '@/db/schema';
import { eq, and, isNull, inArray } from 'drizzle-orm';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantIdParam = searchParams.get('tenantId');
    const search = searchParams.get('search');

    let query = db
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        tenantId: products.tenantId,
        tenantName: tenants.name,
      })
      .from(products)
      .leftJoin(tenants, eq(products.tenantId, tenants.id))
      .where(
        and(
          eq(products.status, 'ACTIVE'),
          eq(tenants.status, 'ACTIVE')
        )
      )
      .$dynamic();

    const results = await query;
    
    let filteredResults = results;
    
    if (tenantIdParam) {
      filteredResults = filteredResults.filter(p => p.tenantId === parseInt(tenantIdParam));
    }
    
    if (search) {
      const s = search.toLowerCase();
      filteredResults = filteredResults.filter(p => p.name.toLowerCase().includes(s) || (p.tenantName && p.tenantName.toLowerCase().includes(s)));
    }

    if (filteredResults.length > 0) {
      const productIds = filteredResults.map(p => p.id);
      const allVariants = await db.select({
        id: productVariants.id,
        productId: productVariants.productId,
        name: productVariants.name,
        quantity: productVariants.quantity,
        unit: productVariants.unit,
        price: productVariants.price,
        stock: productVariants.stock,
        weight: productVariants.weight,
        quota: productVariants.quota,
        status: productVariants.status,
      }).from(productVariants).where(inArray(productVariants.productId, productIds));
      const variantIds = allVariants.map(v => v.id);
      const allUnits = variantIds.length > 0
        ? await db.select({
            id: productSellingUnits.id,
            productId: productSellingUnits.productId,
            variantId: productSellingUnits.variantId,
            unitName: productSellingUnits.unitName,
            equivalentQty: productSellingUnits.equivalentQty,
            description: productSellingUnits.description,
            price: productSellingUnits.price,
            status: productSellingUnits.status,
          }).from(productSellingUnits).where(inArray(productSellingUnits.variantId, variantIds))
        : [];

      const unitsByVariant: Record<number, any[]> = {};
      for (const unit of allUnits) {
        if (unit.variantId == null) continue;
        if (!unitsByVariant[unit.variantId]) unitsByVariant[unit.variantId] = [];
        unitsByVariant[unit.variantId].push(unit);
      }

      filteredResults = filteredResults.map(p => {
        const variants = allVariants.filter((v: any) => v.productId === p.id && v.status === 'ACTIVE').map((v: any) => ({
          ...v,
          variantName: v.name,
          sellingUnits: (unitsByVariant[v.id] || []).filter((unit: any) => unit.status === 'ACTIVE'),
        }));

        const baseVariant = variants[0] || {};
        const totalStock = variants.reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);

        return {
          ...p,
          price: baseVariant.price || '0',
          stock: totalStock,
          unit: baseVariant.unit || '',
          variants,
        };
      });
    }

    return NextResponse.json(filteredResults, { status: 200 });

  } catch (error) {
    console.error('Marketplace error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
