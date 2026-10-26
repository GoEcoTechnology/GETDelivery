import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits, inventoryTransactions, cartItems, deliveryItems, deliveryBatches, deliveryOrders } from '@/db/schema';
import { eq, and, ne, inArray, sql } from 'drizzle-orm';
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
        description: products.description,
        weightKg: products.weightKg,
        lengthCm: products.lengthCm,
        widthCm: products.widthCm,
        heightCm: products.heightCm,
        isShippable: products.isShippable,
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
        weightKg: productVariants.weightKg,
        weightPerPieceKg: productVariants.weightPerPieceKg,
        lengthCm: productVariants.lengthCm,
        widthCm: productVariants.widthCm,
        heightCm: productVariants.heightCm,
        quota: productVariants.quota,
      }).from(productVariants).where(and(eq(productVariants.productId, id), ne(productVariants.status, 'ARCHIVED')));
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
          weightKg: productSellingUnits.weightKg,
          lengthCm: productSellingUnits.lengthCm,
          widthCm: productSellingUnits.widthCm,
          heightCm: productSellingUnits.heightCm,
          price: productSellingUnits.price,
          }).from(productSellingUnits).where(and(inArray(productSellingUnits.variantId, variantIds), ne(productSellingUnits.status, 'ARCHIVED')));
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

      const isShippable = body.isShippable !== false;
      const weightKg = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== '' ? Number(body.weightKg) : null;
      const lengthCm = body.lengthCm !== undefined && body.lengthCm !== null && body.lengthCm !== '' ? Number(body.lengthCm) : null;
      const widthCm = body.widthCm !== undefined && body.widthCm !== null && body.widthCm !== '' ? Number(body.widthCm) : null;
      const heightCm = body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== '' ? Number(body.heightCm) : null;

      if (isShippable) {
        if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) {
          return NextResponse.json({ error: 'Product Weight (kg) must be a positive number greater than 0.' }, { status: 400 });
        }
        if (lengthCm !== null && (!Number.isFinite(lengthCm) || lengthCm <= 0)) {
          return NextResponse.json({ error: 'Product Length (cm) must be a positive number greater than 0.' }, { status: 400 });
        }
        if (widthCm !== null && (!Number.isFinite(widthCm) || widthCm <= 0)) {
          return NextResponse.json({ error: 'Product Width (cm) must be a positive number greater than 0.' }, { status: 400 });
        }
        if (heightCm !== null && (!Number.isFinite(heightCm) || heightCm <= 0)) {
          return NextResponse.json({ error: 'Product Height (cm) must be a positive number greater than 0.' }, { status: 400 });
        }
      }

      let condition = eq(products.id, id);
      if (claims.role !== 'PLATFORM_OWNER') {
        condition = and(condition, eq(products.tenantId, claims.tenantId as number)) as any;
      }

      const updateFields: any = {
        name: body.name,
        category: body.category,
        description: body.description !== undefined ? body.description : undefined,
        status: body.status,
        isMarketplace: body.isMarketplace,
        isShippable,
        updatedAt: new Date(),
      };
      if (weightKg !== null) updateFields.weightKg = String(weightKg);
      if (lengthCm !== null) updateFields.lengthCm = String(lengthCm);
      if (widthCm !== null) updateFields.widthCm = String(widthCm);
      if (heightCm !== null) updateFields.heightCm = String(heightCm);

      const [updatedProduct] = await tx
        .update(products)
        .set(updateFields)
        .where(condition)
        .returning();

      if (!updatedProduct) {
        return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
      }
      
      // Also update default variant if fields were provided
      const variantUpdateFields: any = {
        updatedAt: new Date(),
      };
      if (body.price !== undefined) variantUpdateFields.price = String(body.price);
      if (body.stock !== undefined) variantUpdateFields.stock = Number(body.stock);
      if (body.unit !== undefined) variantUpdateFields.unit = body.unit;
      if (body.lowStockThreshold !== undefined) variantUpdateFields.lowStockThreshold = Number(body.lowStockThreshold);
      if (weightKg !== null) {
        variantUpdateFields.weightKg = String(weightKg);
        variantUpdateFields.weightPerPieceKg = String(weightKg);
        variantUpdateFields.weight = String(weightKg);
      }
      if (lengthCm !== null) variantUpdateFields.lengthCm = String(lengthCm);
      if (widthCm !== null) variantUpdateFields.widthCm = String(widthCm);
      if (heightCm !== null) variantUpdateFields.heightCm = String(heightCm);

      await tx
        .update(productVariants)
        .set(variantUpdateFields)
        .where(eq(productVariants.productId, id));

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

    const [existingProduct] = await tx.select().from(products).where(condition).limit(1);
    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found or unauthorized' }, { status: 404 });
    }

    // Get all variant IDs for this product
    const variantRows = await tx
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, id));
    const variantIds = variantRows.map((v: { id: number }) => v.id);

    // Run all historical checks IN PARALLEL with .limit(1) for instant verification
    const [delivItemsRes, delivBatchesRes, delivOrdersRes, invTxRes] = await Promise.all([
      // 1. check deliveryItems
      tx
        .select({ id: deliveryItems.id })
        .from(deliveryItems)
        .where(
          variantIds.length > 0
            ? sql`${deliveryItems.productId} = ${id} OR ${deliveryItems.variantId} IN (${sql.join(variantIds.map((vid: number) => sql`${vid}`), sql`, `)})`
            : eq(deliveryItems.productId, id)
        )
        .limit(1),

      // 2. check deliveryBatches
      variantIds.length > 0
        ? tx
            .select({ id: deliveryBatches.id })
            .from(deliveryBatches)
            .where(inArray(deliveryBatches.variantId, variantIds))
            .limit(1)
        : Promise.resolve([]),

      // 3. check deliveryOrders
      tx
        .select({ id: deliveryOrders.id })
        .from(deliveryOrders)
        .where(
          variantIds.length > 0
            ? sql`${deliveryOrders.basisProductId} = ${id} OR ${deliveryOrders.basisVariantId} IN (${sql.join(variantIds.map((vid: number) => sql`${vid}`), sql`, `)})`
            : eq(deliveryOrders.basisProductId, id)
        )
        .limit(1),

      // 4. check inventoryTransactions
      tx
        .select({ id: inventoryTransactions.id })
        .from(inventoryTransactions)
        .where(
          variantIds.length > 0
            ? sql`${inventoryTransactions.productId} = ${id} OR ${inventoryTransactions.variantId} IN (${sql.join(variantIds.map((vid: number) => sql`${vid}`), sql`, `)})`
            : eq(inventoryTransactions.productId, id)
        )
        .limit(1)
    ]);

    const hasHistoricalData =
      delivItemsRes.length > 0 ||
      delivBatchesRes.length > 0 ||
      delivOrdersRes.length > 0 ||
      invTxRes.length > 0;

    // Clear cart items referencing this product
    try {
      await tx.delete(cartItems).where(eq(cartItems.productId, id));
    } catch (e) {}

    if (hasHistoricalData) {
      // Archive product, variants, and selling units in parallel
      const [archived] = await Promise.all([
        tx
          .update(products)
          .set({
            status: 'ARCHIVED',
            isMarketplace: false,
            updatedAt: new Date(),
          })
          .where(condition)
          .returning({ id: products.id, name: products.name }),
        tx
          .update(productVariants)
          .set({
            status: 'ARCHIVED',
            updatedAt: new Date(),
          })
          .where(eq(productVariants.productId, id)),
        tx
          .update(productSellingUnits)
          .set({
            status: 'ARCHIVED',
          })
          .where(eq(productSellingUnits.productId, id))
      ]);

      return NextResponse.json({
        data: archived[0],
        message: 'Product archived successfully.',
      });
    }

    // No historical records: safe to hard delete
    const [deleted] = await tx.delete(products).where(condition).returning();
    return NextResponse.json({ data: deleted, message: 'Product deleted successfully.' });
  });
}
