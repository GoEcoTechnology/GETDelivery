import { NextResponse } from 'next/server';
import { products, productVariants, productSellingUnits, inventoryTransactions } from '@/db/schema';
import { eq, and, ne, ilike, desc, sql, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  console.log("HIT /api/products GET - timestamp:", Date.now());
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

    const statusParam = searchParams.get('status');
    let statusCond;
    if (statusParam && statusParam !== 'ALL') {
      statusCond = eq(products.status, statusParam);
    } else if (statusParam !== 'ALL') {
      statusCond = ne(products.status, 'ARCHIVED');
    }

    if (statusCond) {
      conditions = conditions ? and(conditions, statusCond) : statusCond;
    }

    // 1. Fetch parent products and total count in PARALLEL
    const [productList, countResult] = await Promise.all([
      tx
        .select({
          id: products.id,
          name: products.name,
          category: products.category,
          description: products.description,
          status: products.status,
          isMarketplace: products.isMarketplace,
          createdAt: products.createdAt,
        })
        .from(products)
        .where(conditions)
        .limit(limit)
        .offset(offset)
        .orderBy(desc(products.createdAt)),
      tx
        .select({ count: sql`count(*)` })
        .from(products)
        .where(conditions)
    ]);
      
    const totalCount = Number(countResult[0]?.count || 0);

    // 2. Fetch variants and selling units for these products in PARALLEL
    const productIds = productList.map((p: { id: number }) => p.id);
    let variantsData: any[] = [];
    let sellingUnitsData: any[] = [];

    if (productIds.length > 0) {
      [variantsData, sellingUnitsData] = await Promise.all([
        tx
          .select({
            id: productVariants.id,
            productId: productVariants.productId,
            name: productVariants.name,
            quantity: productVariants.quantity,
            unit: productVariants.unit,
            price: productVariants.price,
            stock: productVariants.stock,
            lowStockThreshold: productVariants.lowStockThreshold,
            status: productVariants.status,
            weight: productVariants.weight,
            weightKg: productVariants.weightKg,
            weightPerPieceKg: productVariants.weightPerPieceKg,
            lengthCm: productVariants.lengthCm,
            widthCm: productVariants.widthCm,
            heightCm: productVariants.heightCm,
            quota: productVariants.quota,
          })
          .from(productVariants)
          .where(and(inArray(productVariants.productId, productIds), ne(productVariants.status, 'ARCHIVED')))
          .orderBy(productVariants.id),
        tx
          .select({
            id: productSellingUnits.id,
            variantId: productSellingUnits.variantId,
            productId: productSellingUnits.productId,
            unitName: productSellingUnits.unitName,
            equivalentQty: productSellingUnits.equivalentQty,
            description: productSellingUnits.description,
            price: productSellingUnits.price,
            status: productSellingUnits.status,
            weight: productSellingUnits.weight,
            weightKg: productSellingUnits.weightKg,
            lengthCm: productSellingUnits.lengthCm,
            widthCm: productSellingUnits.widthCm,
            heightCm: productSellingUnits.heightCm,
            quota: productSellingUnits.quota,
          })
          .from(productSellingUnits)
          .where(and(inArray(productSellingUnits.productId, productIds), ne(productSellingUnits.status, 'ARCHIVED')))
      ]);
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

    const isShippable = body.isShippable !== false;
    const parentWeightKg = body.weightKg !== undefined && body.weightKg !== null && body.weightKg !== '' ? Number(body.weightKg) : null;
    const parentLengthCm = body.lengthCm !== undefined && body.lengthCm !== null && body.lengthCm !== '' ? Number(body.lengthCm) : null;
    const parentWidthCm = body.widthCm !== undefined && body.widthCm !== null && body.widthCm !== '' ? Number(body.widthCm) : null;
    const parentHeightCm = body.heightCm !== undefined && body.heightCm !== null && body.heightCm !== '' ? Number(body.heightCm) : null;

    if (isShippable) {
      if (parentWeightKg !== null && (!Number.isFinite(parentWeightKg) || parentWeightKg <= 0)) {
        return NextResponse.json({ error: 'Product Weight (kg) must be a positive number greater than 0.' }, { status: 400 });
      }
      if (parentLengthCm !== null && (!Number.isFinite(parentLengthCm) || parentLengthCm <= 0)) {
        return NextResponse.json({ error: 'Product Length (cm) must be a positive number greater than 0.' }, { status: 400 });
      }
      if (parentWidthCm !== null && (!Number.isFinite(parentWidthCm) || parentWidthCm <= 0)) {
        return NextResponse.json({ error: 'Product Width (cm) must be a positive number greater than 0.' }, { status: 400 });
      }
      if (parentHeightCm !== null && (!Number.isFinite(parentHeightCm) || parentHeightCm <= 0)) {
        return NextResponse.json({ error: 'Product Height (cm) must be a positive number greater than 0.' }, { status: 400 });
      }
    }

    const productInsertValues: any = {
      tenantId: tenantIdToUse as number,
      name: String(name).trim(),
      category: category || null,
      description: description || null,
      weightKg: parentWeightKg !== null ? String(parentWeightKg) : null,
      lengthCm: parentLengthCm !== null ? String(parentLengthCm) : null,
      widthCm: parentWidthCm !== null ? String(parentWidthCm) : null,
      heightCm: parentHeightCm !== null ? String(parentHeightCm) : null,
      isShippable,
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
      let variantWeight = Number(variant.weightKg ?? variant.weight ?? parentWeightKg);
      let variantLength = Number(variant.lengthCm ?? parentLengthCm);
      let variantWidth = Number(variant.widthCm ?? parentWidthCm);
      let variantHeight = Number(variant.heightCm ?? parentHeightCm);
      const variantQuota = Number(variant.quota);
      const variantStock = Number(variant.stock);

      if (!variant.name?.trim()) {
        return NextResponse.json({ error: 'Variant name is required.' }, { status: 400 });
      }
      if (!Number.isFinite(variantPrice) || variantPrice < 0) {
        return NextResponse.json({ error: `Price for variant "${variant.name}" must be a valid positive number.` }, { status: 400 });
      }
      if (!Number.isFinite(variantStock) || variantStock < 0) {
        return NextResponse.json({ error: `Available stock for variant "${variant.name}" must be 0 or greater.` }, { status: 400 });
      }

      if (isShippable) {
        if (!Number.isFinite(variantWeight) || variantWeight <= 0) {
          return NextResponse.json({ error: `Weight (kg) for "${variant.name}" is required and must be greater than 0.` }, { status: 400 });
        }
        if (!Number.isFinite(variantLength) || variantLength <= 0) {
          return NextResponse.json({ error: `Length (cm) for "${variant.name}" is required and must be greater than 0.` }, { status: 400 });
        }
        if (!Number.isFinite(variantWidth) || variantWidth <= 0) {
          return NextResponse.json({ error: `Width (cm) for "${variant.name}" is required and must be greater than 0.` }, { status: 400 });
        }
        if (!Number.isFinite(variantHeight) || variantHeight <= 0) {
          return NextResponse.json({ error: `Height (cm) for "${variant.name}" is required and must be greater than 0.` }, { status: 400 });
        }
      }

      const [newVariant] = await tx
        .insert(productVariants)
        .values({
          tenantId: tenantIdToUse as number,
          productId: newProduct.id,
          name: String(variant.name || 'Regular').trim() || 'Regular',
          quantity: quantity > 0 ? quantity : 1,
          unit: variant.unit || unit || 'pcs',
          price: String(variantPrice),
          stock: variantStock,
          lowStockThreshold: variant.lowStockThreshold ?? lowStockThreshold ?? 10,
          productType: variant.productType || productType || null,
          weight: String(variantWeight),
          weightKg: String(variantWeight),
          weightPerPieceKg: String(variantWeight),
          lengthCm: String(variantLength),
          widthCm: String(variantWidth),
          heightCm: String(variantHeight),
          quota: variantQuota > 0 ? variantQuota : 1,
          status: variant.status || 'ACTIVE',
        })
        .returning();

      // Log initial stock if greater than 0
      if (variantStock > 0) {
        await tx.insert(inventoryTransactions).values({
          tenantId: tenantIdToUse as number,
          productId: newProduct.id,
          variantId: newVariant.id,
          quantity: variantStock,
          previousStock: 0,
          newStock: variantStock,
          transactionType: 'IN',
          reference: 'Initial Stock',
          performedBy: claims.userId,
        });
      }

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
