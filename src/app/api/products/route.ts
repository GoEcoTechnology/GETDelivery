import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits } from '@/db/schema';
import { eq, and, ilike, desc, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '25', 10);
    const search = searchParams.get('search') || '';

    const offset = (page - 1) * limit;

    let conditions: any = undefined;
    
    if (claims.role !== 'PLATFORM_OWNER') {
      conditions = eq(products.tenantId, claims.tenantId as number);
    }
    
    if (search) {
      const searchCond = ilike(products.name, `%${search}%`);
      conditions = conditions ? and(conditions, searchCond) : searchCond;
    }

    // Fetch parent products only (paginated)
    const productList = await tx
      .select({
        id: products.id,
        name: products.name,
        category: products.category,
        status: products.status,
        isMarketplace: products.isMarketplace,
        createdAt: products.createdAt,
        tenantId: products.tenantId,
      })
      .from(products)
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(products.createdAt));

    // Get total count for pagination
    const countResult = await tx
      .select({ count: sql`count(*)` })
      .from(products)
      .where(conditions);
      
    const totalCount = Number(countResult[0]?.count || 0);

    // Fetch all variants for these products
    const productIds = productList.map((p: { id: number }) => p.id);
    let variantsData: any[] = [];
    let sellingUnitsData: any[] = [];

    if (productIds.length > 0) {
      const { inArray } = await import('drizzle-orm');
      
      variantsData = await tx
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          name: productVariants.name,
          unit: productVariants.unit,
          price: productVariants.price,
          stock: productVariants.stock,
          lowStockThreshold: productVariants.lowStockThreshold,
          quantity: productVariants.quantity,
          quota: productVariants.quota,
          productType: productVariants.productType,
          status: productVariants.status,
          weight: productVariants.weight,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
        .orderBy(productVariants.id);

      sellingUnitsData = await tx
        .select({
          id: productSellingUnits.id,
          variantId: productSellingUnits.variantId,
          productId: productSellingUnits.productId,
          unitName: productSellingUnits.unitName,
          equivalentQty: productSellingUnits.equivalentQty,
          description: productSellingUnits.description,
          price: productSellingUnits.price,
          status: productSellingUnits.status,
        })
        .from(productSellingUnits)
        .where(inArray(productSellingUnits.productId, productIds));
    }

    // Group variants and selling units under products
    const variantsByProduct: Record<number, any[]> = {};
    for (const v of variantsData) {
      if (!variantsByProduct[v.productId]) variantsByProduct[v.productId] = [];
      variantsByProduct[v.productId].push(v);
    }

    const sellingUnitsByVariant: Record<number, any[]> = {};
    for (const su of sellingUnitsData) {
      if (!sellingUnitsByVariant[su.variantId]) sellingUnitsByVariant[su.variantId] = [];
      sellingUnitsByVariant[su.variantId].push(su);
    }

    // Attach to each product
    const data = productList.map((p: typeof productList[0]) => ({
      ...p,
      variants: (variantsByProduct[p.id] || []).map(v => ({
        ...v,
        sellingUnits: sellingUnitsByVariant[v.id] || [],
      })),
      // Convenience: first variant's data for backward compat display
      price: variantsByProduct[p.id]?.[0]?.price ?? null,
      stock: variantsByProduct[p.id]?.[0]?.stock ?? null,
      unit: variantsByProduct[p.id]?.[0]?.unit ?? null,
      lowStockThreshold: variantsByProduct[p.id]?.[0]?.lowStockThreshold ?? null,
    }));

    return NextResponse.json({ data, page, limit, totalCount });
  });
}

export async function POST(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.create'] }, async (tx, claims) => {
    const body = await request.json();
    const {
      name,
      category,
      productType,
      isMarketplace,
      variants,
      unit,
      price,
      stock,
      description,
      lowStockThreshold,
    } = body;

    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' && body.tenantId
      ? body.tenantId
      : claims.tenantId;

    if (!tenantIdToUse) {
      return NextResponse.json({ error: 'Tenant ID is required' }, { status: 400 });
    }

    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const productInsertValues: any = {
      tenantId: tenantIdToUse as number,
      name: String(name).trim(),
      category: category || null,
      status: 'ACTIVE',
      isMarketplace: isMarketplace ?? true,
    };

    const [newProduct] = await tx
      .insert(products)
      .values(productInsertValues)
      .returning();

    const createdVariants: any[] = [];

    if (!Array.isArray(variants) || variants.length === 0) {
      return NextResponse.json({ error: 'At least one complete variant is required.' }, { status: 400 });
    }

    const variantArray = variants;

    for (const variant of variantArray) {
      const quantity = Number(variant.quantity);
      const variantPrice = Number(variant.price);
      const variantWeight = Number(variant.weight);
      const variantQuota = Number(variant.quota);
      const variantStock = Number(variant.stock);
      if (!variant.name?.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(variantPrice) || variantPrice < 0 || !Number.isFinite(variantWeight) || variantWeight < 0 || !Number.isFinite(variantQuota) || variantQuota < 0 || !Number.isFinite(variantStock) || variantStock < 0) {
        return NextResponse.json({ error: 'Each variant requires a name, quantity, price, weight, quota, and stock.' }, { status: 400 });
      }

      const [newVariant] = await tx
        .insert(productVariants)
        .values({
          tenantId: tenantIdToUse as number,
          productId: newProduct.id,
          name: String(variant.name || 'Regular').trim() || 'Regular',
          quantity,
          unit: variant.unit || unit || 'pcs',
          price: variantPrice,
          stock: variantStock,
          lowStockThreshold: variant.lowStockThreshold ?? lowStockThreshold ?? 10,
          productType: variant.productType || productType || null,
          weight: String(variantWeight),
          quota: variantQuota,
          status: variant.status || 'ACTIVE',
        })
        .returning();

      const sellingUnits = Array.isArray(variant.sellingUnits) ? variant.sellingUnits : [];
      for (const sellingUnit of sellingUnits) {
        if (!sellingUnit.unitName?.trim() || !sellingUnit.description?.trim() || !Number.isFinite(Number(sellingUnit.equivalentQty)) || Number(sellingUnit.equivalentQty) <= 0 || !Number.isFinite(Number(sellingUnit.price)) || Number(sellingUnit.price) < 0) {
          return NextResponse.json({ error: 'Each selling unit requires a name, quantity per unit, description, and price.' }, { status: 400 });
        }
      }
      if (sellingUnits.length > 0) {
        await tx.insert(productSellingUnits).values(
          sellingUnits.map((su: any) => ({
            tenantId: tenantIdToUse as number,
            productId: newProduct.id,
            variantId: newVariant.id,
            unitName: String(su.unitName || su.name || 'Unit').trim() || 'Unit',
            description: String(su.description || '').trim(),
            equivalentQty: su.equivalentQty ?? 1,
            weight: su.weight || null,
            quota: su.quota ?? null,
            price: su.price ?? variant.price ?? price ?? 0,
            status: su.status || 'ACTIVE',
          }))
        );
      }

      createdVariants.push({
        ...newVariant,
        sellingUnits: sellingUnits.map((su: any) => ({
          id: null,
          tenantId: tenantIdToUse as number,
          productId: newProduct.id,
          variantId: newVariant.id,
          unitName: String(su.unitName || su.name || 'Unit').trim() || 'Unit',
          equivalentQty: su.equivalentQty ?? 1,
          weight: su.weight || null,
          quota: su.quota ?? null,
          price: su.price ?? variant.price ?? price ?? 0,
          status: su.status || 'ACTIVE',
        }))
      });
    }

    return NextResponse.json({ data: { ...newProduct, variants: createdVariants } }, { status: 201 });
  });
}
