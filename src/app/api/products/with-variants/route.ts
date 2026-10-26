import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, asc, and, ne } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const tenantParam = searchParams.get('tenantId');
    const headerTenant = request.headers.get('x-tenant-id');
    const tenantId = (claims as any).tenantId || (tenantParam ? parseInt(tenantParam, 10) : (headerTenant ? parseInt(headerTenant, 10) : null));

    const variantConditions: any[] = [
      ne(products.status, 'ARCHIVED'),
      ne(productVariants.status, 'ARCHIVED'),
    ];
    if (tenantId) {
      variantConditions.push(eq(products.tenantId, tenantId));
    }

    const sellingUnitConditions: any[] = [
      ne(productSellingUnits.status, 'ARCHIVED'),
    ];
    if (tenantId) {
      sellingUnitConditions.push(eq(productSellingUnits.tenantId, tenantId));
    }

    const [variantRows, sellingUnitRows] = await Promise.all([
      // Fetch all variants with product info
      tx.select({
        productId: products.id,
        productName: products.name,
        tenantId: products.tenantId,
        variantId: productVariants.id,
        variantName: productVariants.name,
        stock: productVariants.stock,
        unit: productVariants.unit,
        price: productVariants.price,
      })
        .from(productVariants)
        .innerJoin(products, eq(productVariants.productId, products.id))
        .where(and(...variantConditions))
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
        .where(and(...sellingUnitConditions))
        .limit(2000)
    ]);

    // Group variants by product
    const productMap: Record<number, { id: number; name: string; tenantId?: number | null; variants: any[] }> = {};
    for (const row of variantRows) {
      if (!productMap[row.productId]) {
        productMap[row.productId] = { id: row.productId, name: row.productName, tenantId: row.tenantId, variants: [] };
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
