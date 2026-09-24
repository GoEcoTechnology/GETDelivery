import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';
import { cookies } from 'next/headers';

async function getAuth(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const claims = await verifyToken(authHeader.slice(7));
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

  const { id } = await params;
  const productId = parseInt(id);

  const product = await db
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
    .where(eq(products.id, productId))
    .limit(1);
  if (!product.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let variants: any[] = [];
  let sellingUnits: any[] = [];

  try {
    variants = await db.select({
      id: productVariants.id,
      tenantId: productVariants.tenantId,
      productId: productVariants.productId,
      name: productVariants.name,
      quantity: productVariants.quantity,
      unit: productVariants.unit,
      price: productVariants.price,
      stock: productVariants.stock,
      weight: productVariants.weight,
      weightPerPieceKg: productVariants.weightPerPieceKg,
      quota: productVariants.quota,
      status: productVariants.status,
    }).from(productVariants).where(eq(productVariants.productId, productId));
    const variantIds = variants.map(v => v.id);

    if (variantIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      sellingUnits = await db.select({
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
    console.warn('Falling back to base product records because variant tables are unavailable:', error);
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
      variants: variants.map(v => ({ ...v, sellingUnits: suByVariant[v.id] || [] }))
    }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const claims = await getAuth(request);
  if (!claims) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const productId = parseInt(id);
  const body = await request.json();

  const quantity = Number(body.quantity) || 1;
  const price = Number(body.price);
  const weightPerPieceKg = Number(body.weightPerPieceKg);
  const quota = Number(body.quota) || 0;
  const stock = Number(body.stock) || 0;
  
  if (!body.name?.trim() || !Number.isFinite(price) || price < 0 || !Number.isFinite(weightPerPieceKg) || weightPerPieceKg < 0) {
    return NextResponse.json({ error: 'Variant name, price (>=0), and weightPerPieceKg (>=0) are required.' }, { status: 400 });
  }

  const [variant] = await db.insert(productVariants).values({
    tenantId: claims.tenantId as number,
    productId,
    name: body.name,
    quantity,
    unit: body.unit,
    price: String(price),
    stock,
    lowStockThreshold: body.lowStockThreshold ?? 10,
    weight: String(weightPerPieceKg),
    weightPerPieceKg: String(weightPerPieceKg),
    quota,
    status: body.status ?? 'ACTIVE',
  }).returning();

  return NextResponse.json({ data: variant }, { status: 201 });
}
