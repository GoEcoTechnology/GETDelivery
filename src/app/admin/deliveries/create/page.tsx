import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { withRLS } from '@/db';
import { customers, products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import CreateDeliveryClient from './CreateDeliveryClient';

export default async function CreateDeliveryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) redirect('/login');

  const claims = await verifyToken(token);
  if (!claims) redirect('/login');

  const tenantId = (claims as any).tenantId;

  const [customersList, variantRows, sellingUnitRows] = await Promise.all([
    withRLS(claims, async (tx) =>
      tx.select({
        id: customers.id,
        name: customers.name,
        customerCode: customers.customerCode,
        mobileNumber: customers.mobileNumber,
        address: customers.address,
        barangay: customers.barangay,
        municipality: customers.municipality,
      })
        .from(customers)
        .where(eq(customers.tenantId, tenantId))
        .orderBy(asc(customers.name))
        .limit(200)
    ),
    // Fetch all variants with product info
    withRLS(claims, async (tx) =>
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
        .limit(500)
    ),
    // Fetch all active selling units
    withRLS(claims, async (tx) =>
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
        .limit(1000)
    ),
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

  return <CreateDeliveryClient customers={customersList} products={productsList} />;
}
