import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const tenantId = (claims as any).tenantId;

    const [variantRows, sellingUnitRows] = await Promise.all([
      // Fetch all variants with product info
      tx.select({
        productId: products.id,
        productName: products.name,
        variantId: productVariants.id,
        variantName: productVariants.name,
        stock: productVariants.stock,
        unit: productVariants.unit,
        price: productVariants.price,
      })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(eq(products.tenantId, tenantId))
        .orderBy(asc(products.name), asc(productVariants.name))
        .limit(1000),
      
      // Fetch all active selling units
      tx.select({
        id: productSellingUnits.id,
        productId: productSellingUnits.productId,
        variantId: productSellingUnits.variantId,
        unitName: productSellingUnits.unitName,
        price: productSellingUnits.price,
        equivalentQty: productSellingUnits.equivalentQty,
      })
        .from(productSellingUnits)
        .where(eq(productSellingUnits.tenantId, tenantId))
        .limit(2000)
    ]);

    // Group variants by product
    const productMap: Record<number, { id: number; name: string; variants: any[] }> = {};
    for (const row of variantRows) {
      if (!productMap[row.productId]) {
        productMap[row.productId] = { id: row.productId, name: row.productName, variants: [] };
      }
      const sellingUnits = sellingUnitRows.filter(
        (su: any) => su.variantId === row.variantId || (!su.variantId && su.productId === row.productId)
      );
      productMap[row.productId].variants.push({
        id: row.variantId,
        name: row.variantName,
        stock: row.stock,
        unit: row.unit,
        price: row.price,
        sellingUnits,
      });
    }

    const productsList = Object.values(productMap);

    return NextResponse.json({ data: productsList });
  });
}
