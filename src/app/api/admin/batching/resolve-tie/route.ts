import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryOrders, products, productVariants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);
    if (!claims || !claims.tenantId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
    const tenantId = claims.tenantId as number;

    const { orderId, basisProductId, basisVariantId, basisQuantity } = await request.json();

    if (!orderId || !basisProductId || basisVariantId === undefined || !basisQuantity) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify product belongs to tenant
    const [product] = await db.select().from(products).where(and(eq(products.id, basisProductId), eq(products.tenantId, tenantId)));
    if (!product) return NextResponse.json({ error: 'Invalid product' }, { status: 400 });

    await db.update(deliveryOrders)
      .set({
        basisProductId,
        basisVariantId,
        basisQuantity,
        hasBasisTie: false
      })
      .where(and(eq(deliveryOrders.id, orderId), eq(deliveryOrders.tenantId, tenantId)));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('API /admin/batching/resolve-tie Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
