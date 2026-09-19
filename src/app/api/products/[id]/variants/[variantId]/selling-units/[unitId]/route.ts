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
  if (!body.unitName?.trim() || !body.description?.trim() || !Number.isFinite(equivalentQty) || equivalentQty <= 0 || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Selling unit name, quantity per unit, description, and price are required.' }, { status: 400 });
  }

  const [updated] = await db.update(productSellingUnits).set({
    unitName: body.unitName.trim(),
    description: body.description.trim(),
    equivalentQty: String(equivalentQty),
    price: String(price),
    status: body.status,
  }).where(eq(productSellingUnits.id, parseInt(unitId))).returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; variantId: string; unitId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { unitId } = await params;
  const [deleted] = await db.delete(productSellingUnits).where(eq(productSellingUnits.id, parseInt(unitId))).returning();
  return NextResponse.json({ data: deleted });
}
