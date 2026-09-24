import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits, inventoryTransactions, cartItems, deliveryItems } from '@/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getAuth(request: Request) {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    const claims = await verifyToken(authorization.slice(7));
    if (claims) return claims;
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  const product = await (await import('@/db')).db
    .select({
      id: products.id,
      tenantId: products.tenantId,
      name: products.name,
      category: products.category,
      status: products.status,
      isMarketplace: products.isMarketplace,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
    })
    .from(products)
    .where(eq(products.id, id))
    .limit(1);
  if (!product.length) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  let variants: any[] = [];
  let sellingUnits: any[] = [];

  try {
    variants = await (await import('@/db')).db.select({
      id: productVariants.id,
      tenantId: productVariants.tenantId,
      productId: productVariants.productId,
      name: productVariants.name,
      quantity: productVariants.quantity,
      unit: productVariants.unit,
      price: productVariants.price,
      stock: productVariants.stock,
      weight: productVariants.weight,
      quota: productVariants.quota,
      status: productVariants.status,
    }).from(productVariants).where(eq(productVariants.productId, id));
    const variantIds = variants.map(v => v.id);

    if (variantIds.length > 0) {
      sellingUnits = await (await import('@/db')).db.select({
        id: productSellingUnits.id,
        tenantId: productSellingUnits.tenantId,
        productId: productSellingUnits.productId,
        variantId: productSellingUnits.variantId,
        unitName: productSellingUnits.unitName,
        equivalentQty: productSellingUnits.equivalentQty,
        description: productSellingUnits.description,
        weight: productSellingUnits.weight,
        price: productSellingUnits.price,
        status: productSellingUnits.status,
      }).from(productSellingUnits).where(inArray(productSellingUnits.variantId, variantIds));
    }
  } catch (error) {
    console.warn('Product variant tables unavailable, returning product without nested variants:', error);
    variants = [];
    sellingUnits = [];
  }

  const suByVariant: Record<number, any[]> = {};
  for (const su of sellingUnits) {
    if (su.variantId == null) continue;
    if (!suByVariant[su.variantId]) suByVariant[su.variantId] = [];
    suByVariant[su.variantId].push(su);
  }

  return NextResponse.json({
    data: {
      ...product[0],
      variants: variants.map(v => ({ ...v, sellingUnits: suByVariant[v.id] || [] })),
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: ['inventory.update'] }, async (tx, claims) => {
    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

    const body = await request.json();

    let condition = eq(products.id, id);
    if (claims.role !== 'PLATFORM_OWNER') {
      condition = and(condition, eq(products.tenantId, claims.tenantId as number)) as any;
    }

    const [updatedProduct] = await tx
      .update(products)
      .set({
        name: body.name,
        category: body.category,
        status: body.status,
        isMarketplace: body.isMarketplace,
        updatedAt: new Date(),
      })
      .where(condition)
      .returning();

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }
    
    // Also update the default variant if fields were provided
    if (body.price || body.stock || body.unit || body.lowStockThreshold) {
      await tx
        .update(productVariants)
        .set({
          price: body.price,
          stock: body.stock,
          unit: body.unit,
          lowStockThreshold: body.lowStockThreshold,
          updatedAt: new Date(),
        })
        .where(eq(productVariants.productId, id));
    }

    if (body.sellingUnits) {
      // Basic sync for selling units based on variant
      const defaultVariant = await tx.select().from(productVariants).where(eq(productVariants.productId, id)).limit(1);
      
      if (defaultVariant.length > 0) {
        const variantId = defaultVariant[0].id;
        await tx.delete(productSellingUnits).where(eq(productSellingUnits.variantId, variantId));

        if (body.sellingUnits.length > 0) {
          await tx.insert(productSellingUnits).values(
            body.sellingUnits.map((su: any) => ({
              tenantId: updatedProduct.tenantId,
              productId: id,
              variantId: variantId,
              unitName: su.unitName,
              equivalentQty: su.equivalentQty,
              price: su.price,
              status: 'ACTIVE'
            }))
          );
        }
      }
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

    const product = await tx.select().from(products).where(condition).limit(1);
    if (!product || product.length === 0) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    const allVariants = await tx.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, id));
    
    // We only need to clear relations pointing to the parent
    await tx.delete(inventoryTransactions).where(eq(inventoryTransactions.productId, id));
    await tx.delete(cartItems).where(eq(cartItems.productId, id));
    await tx.delete(deliveryItems).where(eq(deliveryItems.productId, id));

    const [deleted] = await tx.delete(products).where(condition).returning();

    return NextResponse.json({ data: deleted });
  });
}
