import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { withRLS } from '@/db';
import { customers, products, productVariants } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import CreateDeliveryClient from './CreateDeliveryClient';

export default async function CreateDeliveryPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) redirect('/login');

  const claims = await verifyToken(token);
  if (!claims) redirect('/login');

  // Fetch customers and products server-side in parallel — no client fetch needed
  const [customersList, productsList] = await Promise.all([
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
        .where(eq(customers.tenantId, (claims as any).tenantId))
        .orderBy(asc(customers.name))
        .limit(200)
    ),
    withRLS(claims, async (tx) =>
      tx.select({
        id: products.id,
        name: products.name,
        stock: productVariants.stock,
        unit: productVariants.unit,
        price: productVariants.price,
      })
        .from(products)
        .leftJoin(productVariants, eq(products.id, productVariants.productId))
        .where(eq(products.tenantId, (claims as any).tenantId))
        .orderBy(asc(products.name))
        .limit(200)
    ),
  ]);

  return <CreateDeliveryClient customers={customersList} products={productsList} />;
}
