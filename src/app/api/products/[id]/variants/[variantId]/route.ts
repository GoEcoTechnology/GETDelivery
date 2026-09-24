import { NextResponse } from 'next/server';
import { db } from '@/db';
import { productVariants } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

async function getAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.slice(7));
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const body = await request.json();
  const quantity = Number(body.quantity) || 1;
  const price = Number(body.price);
  const weightPerPieceKg = Number(body.weightPerPieceKg);
  const quota = Number(body.quota) || 0;
  const stock = Number(body.stock) || 0;
  
  if (!body.name?.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(weightPerPieceKg) || weightPerPieceKg < 0) {
    return NextResponse.json({ error: 'Variant name, price (>=0), and weightPerPieceKg (>=0) are required.' }, { status: 400 });
  }

  const [updated] = await db.update(productVariants).set({
    name: body.name,
    quantity,
    unit: body.unit,
    price: String(price),
    stock,
    lowStockThreshold: body.lowStockThreshold,
    weight: String(weightPerPieceKg),
    weightPerPieceKg: String(weightPerPieceKg),
    quota,
    status: body.status,
    updatedAt: new Date(),
  }).where(eq(productVariants.id, parseInt(variantId))).returning();

  return NextResponse.json({ data: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; variantId: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { variantId } = await params;
  const [deleted] = await db.delete(productVariants).where(eq(productVariants.id, parseInt(variantId))).returning();
  return NextResponse.json({ data: deleted });
}
