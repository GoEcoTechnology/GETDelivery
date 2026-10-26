import { NextResponse } from 'next/server';
import { db } from '@/db';
import { products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
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
      weightKg: productVariants.weightKg,
      lengthCm: productVariants.lengthCm,
      widthCm: productVariants.widthCm,
      heightCm: productVariants.heightCm,
      weightPerPieceKg: productVariants.weightPerPieceKg,
      quota: productVariants.quota,
      status: productVariants.status,
    }).from(productVariants).where(and(eq(productVariants.productId, productId), ne(productVariants.status, 'ARCHIVED')));
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
        weightKg: productSellingUnits.weightKg,
        lengthCm: productSellingUnits.lengthCm,
        widthCm: productSellingUnits.widthCm,
        heightCm: productSellingUnits.heightCm,
        price: productSellingUnits.price,
        status: productSellingUnits.status,
      }).from(productSellingUnits).where(and(inArray(productSellingUnits.variantId, variantIds), ne(productSellingUnits.status, 'ARCHIVED')));
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
  const quota = Number(body.quota) || 0;
  const stock = Number(body.stock) || 0;
  
  if (!body.name?.trim() || !Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: 'Variant name and positive price are required.' }, { status: 400 });
  }

  // Fetch parent product to check shippable status and inherit dimensions if not provided
  const [parentProduct] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  const isShippable = parentProduct?.isShippable ?? true;

  // Determine weight & dimensions (allow variant override or inherit from parent)
  let weightVal = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== '' 
    ? Number(body.weightKg) 
    : (body.weightPerPieceKg !== undefined && body.weightPerPieceKg !== null && body.weightPerPieceKg !== ''
      ? Number(body.weightPerPieceKg)
      : (parentProduct?.weightKg ? Number(parentProduct.weightKg) : undefined));

  let lengthVal = body.lengthCm !== undefined && body.lengthCm !== null && body.lengthCm !== '' 
    ? Number(body.lengthCm) 
    : (parentProduct?.lengthCm ? Number(parentProduct.lengthCm) : undefined);

  let widthVal = body.widthCm !== undefined && body.widthCm !== null && body.widthCm !== '' 
    ? Number(body.widthCm) 
    : (parentProduct?.widthCm ? Number(parentProduct.widthCm) : undefined);

  let heightVal = body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== '' 
    ? Number(body.heightCm) 
    : (parentProduct?.heightCm ? Number(parentProduct.heightCm) : undefined);

  if (isShippable) {
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
  }

  const [variant] = await db.insert(productVariants).values({
    tenantId: claims.tenantId as number,
    productId,
    name: body.name.trim(),
    quantity,
    unit: body.unit,
    price: String(price),
    stock,
    lowStockThreshold: body.lowStockThreshold ?? 10,
    weight: weightVal !== undefined ? String(weightVal) : '1',
    weightPerPieceKg: weightVal !== undefined ? String(weightVal) : '1',
    weightKg: weightVal !== undefined ? String(weightVal) : null,
    lengthCm: lengthVal !== undefined ? String(lengthVal) : null,
    widthCm: widthVal !== undefined ? String(widthVal) : null,
    heightCm: heightVal !== undefined ? String(heightVal) : null,
    quota,
    status: body.status ?? 'ACTIVE',
  }).returning();

  return NextResponse.json({ data: variant }, { status: 201 });
}
