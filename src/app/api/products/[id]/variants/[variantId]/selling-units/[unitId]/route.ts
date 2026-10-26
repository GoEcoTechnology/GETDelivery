import { NextResponse } from 'next/server';
import { db } from '@/db';
import { productSellingUnits } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; variantId: string; unitId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { unitId } = await params;
  const body = await request.json();
  const equivalentQty = Number(body.equivalentQty);
  const price = Number(body.price);
  if (!body.unitName?.trim() || !Number.isFinite(equivalentQty) || equivalentQty <= 0 || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Selling unit name, valid quantity per unit, and price are required.' }, { status: 400 });
  }

  const description = body.description?.trim() || `1 ${body.unitName.trim()} = ${equivalentQty} units`;

  let weightVal = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== '' 
    ? Number(body.weightKg) 
    : (body.weight !== undefined && body.weight !== null && body.weight !== '' ? Number(body.weight) : undefined);
  let lengthVal = body.lengthCm !== undefined && body.lengthCm !== null && body.lengthCm !== '' ? Number(body.lengthCm) : undefined;
  let widthVal = body.widthCm !== undefined && body.widthCm !== null && body.widthCm !== '' ? Number(body.widthCm) : undefined;
  let heightVal = body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== '' ? Number(body.heightCm) : undefined;

  if (weightVal !== undefined && (!Number.isFinite(weightVal) || weightVal <= 0)) {
    return NextResponse.json({ error: 'Selling unit weight (kg) must be a positive number (> 0).' }, { status: 400 });
  }
  if (lengthVal !== undefined && (!Number.isFinite(lengthVal) || lengthVal <= 0)) {
    return NextResponse.json({ error: 'Selling unit length (cm) must be a positive number (> 0).' }, { status: 400 });
  }
  if (widthVal !== undefined && (!Number.isFinite(widthVal) || widthVal <= 0)) {
    return NextResponse.json({ error: 'Selling unit width (cm) must be a positive number (> 0).' }, { status: 400 });
  }
  if (heightVal !== undefined && (!Number.isFinite(heightVal) || heightVal <= 0)) {
    return NextResponse.json({ error: 'Selling unit height (cm) must be a positive number (> 0).' }, { status: 400 });
  }

  const updateData: Record<string, any> = {
    unitName: body.unitName.trim(),
    description,
    equivalentQty: String(equivalentQty),
    price: String(price),
    status: body.status || 'ACTIVE',
  };
  if (body.quota !== undefined && body.quota !== null && body.quota !== '') {
    updateData.quota = Number(body.quota);
  }
  if (weightVal !== undefined) {
    updateData.weight = String(weightVal);
    updateData.weightKg = String(weightVal);
  }
  if (lengthVal !== undefined) updateData.lengthCm = String(lengthVal);
  if (widthVal !== undefined) updateData.widthCm = String(widthVal);
  if (heightVal !== undefined) updateData.heightCm = String(heightVal);

  const [updated] = await db.update(productSellingUnits).set(updateData).where(eq(productSellingUnits.id, parseInt(unitId))).returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; variantId: string; unitId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { unitId } = await params;
  const uId = parseInt(unitId, 10);
  if (isNaN(uId)) return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });

  try {
    const [deleted] = await db.delete(productSellingUnits).where(eq(productSellingUnits.id, uId)).returning();
    return NextResponse.json({ data: deleted, message: 'Selling unit deleted successfully.' });
  } catch (err) {
    const [archived] = await db
      .update(productSellingUnits)
      .set({ status: 'ARCHIVED' })
      .where(eq(productSellingUnits.id, uId))
      .returning();
    return NextResponse.json({ data: archived, message: 'Selling unit archived successfully.' });
  }
}
