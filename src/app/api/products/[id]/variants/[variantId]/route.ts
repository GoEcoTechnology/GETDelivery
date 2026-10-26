import { NextResponse } from 'next/server';
import { db } from '@/db';
import { productVariants, productSellingUnits, cartItems, deliveryBatches, deliveryItems, deliveryOrders, inventoryTransactions } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, variantId } = await params;
  const body = await request.json();
  const quantity = Number(body.quantity) || 1;
  const price = Number(body.price);
  const quota = Number(body.quota) || 0;
  const stock = Number(body.stock) || 0;
  
  if (!body.name?.trim() || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Variant name and positive price are required.' }, { status: 400 });
  }

  // Weight & dimensions validation
  let weightVal: number | undefined = undefined;
  if (body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== '') {
    weightVal = Number(body.weightKg);
  } else if (body.weightPerPieceKg !== undefined && body.weightPerPieceKg !== null && body.weightPerPieceKg !== '') {
    weightVal = Number(body.weightPerPieceKg);
  } else if (body.weight !== undefined && body.weight !== null && body.weight !== '') {
    weightVal = Number(body.weight);
  }

  let lengthVal = body.lengthCm !== undefined && body.lengthCm !== null && body.lengthCm !== '' ? Number(body.lengthCm) : undefined;
  let widthVal = body.widthCm !== undefined && body.widthCm !== null && body.widthCm !== '' ? Number(body.widthCm) : undefined;
  let heightVal = body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== '' ? Number(body.heightCm) : undefined;

  if (weightVal !== undefined && (!Number.isFinite(weightVal) || weightVal <= 0)) {
    return NextResponse.json({ error: 'Variant weight (kg) must be a positive number (> 0).' }, { status: 400 });
  }
  if (lengthVal !== undefined && (!Number.isFinite(lengthVal) || lengthVal <= 0)) {
    return NextResponse.json({ error: 'Variant length (cm) must be a positive number (> 0).' }, { status: 400 });
  }
  if (widthVal !== undefined && (!Number.isFinite(widthVal) || widthVal <= 0)) {
    return NextResponse.json({ error: 'Variant width (cm) must be a positive number (> 0).' }, { status: 400 });
  }
  if (heightVal !== undefined && (!Number.isFinite(heightVal) || heightVal <= 0)) {
    return NextResponse.json({ error: 'Variant height (cm) must be a positive number (> 0).' }, { status: 400 });
  }

  const updateData: Record<string, any> = {
    name: body.name.trim(),
    quantity,
    price: String(price),
    stock,
    quota,
    status: body.status || 'ACTIVE',
    updatedAt: new Date(),
  };

  if (body.unit !== undefined && body.unit !== null) {
    updateData.unit = body.unit;
  }
  if (body.lowStockThreshold !== undefined && body.lowStockThreshold !== null && body.lowStockThreshold !== '') {
    updateData.lowStockThreshold = Number(body.lowStockThreshold);
  }

  if (weightVal !== undefined) {
    updateData.weight = String(weightVal);
    updateData.weightPerPieceKg = String(weightVal);
    updateData.weightKg = String(weightVal);
  }
  if (lengthVal !== undefined) updateData.lengthCm = String(lengthVal);
  if (widthVal !== undefined) updateData.widthCm = String(widthVal);
  if (heightVal !== undefined) updateData.heightCm = String(heightVal);

  const [updated] = await db.update(productVariants).set(updateData).where(eq(productVariants.id, parseInt(variantId))).returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const vId = parseInt(variantId, 10);
  if (isNaN(vId)) return NextResponse.json({ error: 'Invalid variant ID' }, { status: 400 });

  // Check if variant has historical activity
  let hasHistory = false;
  
  const bRes = await db
    .select({ count: sql`count(*)` })
    .from(deliveryBatches)
    .where(eq(deliveryBatches.variantId, vId));
  if (Number(bRes[0]?.count || 0) > 0) hasHistory = true;

  if (!hasHistory) {
    const iRes = await db
      .select({ count: sql`count(*)` })
      .from(deliveryItems)
      .where(eq(deliveryItems.variantId, vId));
    if (Number(iRes[0]?.count || 0) > 0) hasHistory = true;
  }

  if (!hasHistory) {
    const oRes = await db
      .select({ count: sql`count(*)` })
      .from(deliveryOrders)
      .where(eq(deliveryOrders.basisVariantId, vId));
    if (Number(oRes[0]?.count || 0) > 0) hasHistory = true;
  }

  if (!hasHistory) {
    const tRes = await db
      .select({ count: sql`count(*)` })
      .from(inventoryTransactions)
      .where(eq(inventoryTransactions.variantId, vId));
    if (Number(tRes[0]?.count || 0) > 0) hasHistory = true;
  }

  // Clear cart items for this variant
  try {
    await db.delete(cartItems).where(eq(cartItems.variantId, vId));
  } catch (e) {}

  if (hasHistory) {
    const [archived] = await db
      .update(productVariants)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(productVariants.id, vId))
      .returning();

    await db
      .update(productSellingUnits)
      .set({ status: 'ARCHIVED' })
      .where(eq(productSellingUnits.variantId, vId));

    return NextResponse.json({ data: archived, message: 'Variant archived successfully.' });
  }

  try {
    const [deleted] = await db.delete(productVariants).where(eq(productVariants.id, vId)).returning();
    return NextResponse.json({ data: deleted, message: 'Variant deleted successfully.' });
  } catch (err) {
    const [archived] = await db
      .update(productVariants)
      .set({ status: 'ARCHIVED', updatedAt: new Date() })
      .where(eq(productVariants.id, vId))
      .returning();
    return NextResponse.json({ data: archived, message: 'Variant archived successfully.' });
  }
}
