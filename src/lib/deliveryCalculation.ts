import { db } from '@/db';
import {
  products,
  productVariants,
  productSellingUnits,
  vehicles,
  vehicleDeliveryRates,
  platformDeliverySettings,
  packageCategories,
  tenants,
  deliveryBatches,
  deliveryBatchItems,
  deliveryOrders,
  deliveryItems,
} from '@/db/schema';
import { eq, and, inArray, desc, sql } from 'drizzle-orm';

export interface CheckoutItemInput {
  productId: number;
  variantId?: number | null;
  sellingUnitId?: number | null;
  quantity: number;
  unitPrice?: number | null;
}

export interface DeliveryCalculationParams {
  items: CheckoutItemInput[];
  tenantId: number;
  dropoffLat: number | null | undefined;
  dropoffLng: number | null | undefined;
  priority?: string | null;
  customDistanceKm?: number | null;
  courierCode?: string | null;
}

export interface ItemBreakdown {
  productId: number;
  variantId: number;
  productName: string;
  variantName: string;
  unit: string;
  quantity: number;
  quota: number;
  weightPerQuotaKg: number;
  itemWeightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PackageCategoryResult {
  code: string;
  name: string;
  description?: string | null;
  rangeDescription?: string;
  isExceeded: boolean;
}

export interface DeliveryCalculationResult {
  success: boolean;
  error?: string;
  validationErrors?: string[];
  totalQuota: number;
  totalWeightKg: number;
  distanceKm: number;
  itemsSubtotal: number;
  packedDimensions: {
    lengthCm: number;
    widthCm: number;
    heightCm: number;
    totalVolumeCm3: number;
  };
  packageCategory: PackageCategoryResult;
  vehicle?: {
    id: number | null;
    physicalVehicleId?: number | null;
    plateNumber: string;
    vehicleType: string;
    capacityKg: number;
    cargoLengthCm: number;
    cargoWidthCm: number;
    cargoHeightCm: number;
    tenantId: number | null;
  };
  pricing?: {
    vehicleType: string;
    basePrice: number; // strictly 0 (base fee removed)
    pricePerKm: number;
    distanceFee: number;
    actualWeightKg?: number;
    volumetricWeightKg?: number;
    chargeableWeightKg?: number;
    baseWeightKg?: number;
    baseWeightFee?: number;
    weightFee?: number;
    normalDeliveryFee: number;
    urgentFee: number;
    totalShippingFee: number;
  };
  grandTotal: number;
  itemBreakdown: ItemBreakdown[];
  allEligibleVehicles?: Array<{
    id: number | null;
    physicalVehicleId?: number | null;
    plateNumber: string;
    vehicleType: string;
    capacityKg: number;
    cargoLengthCm: number;
    cargoWidthCm: number;
    cargoHeightCm: number;
  }>;
  shippingRateDetails?: Record<string, any>;
}

export interface ShippingDimensionValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates mandatory positive dimensions and weight for shippable products.
 * Rejects zero, negative, empty, and non-finite values.
 */
export function validateProductShippingDimensions(data: {
  isShippable?: boolean | null;
  weightKg?: number | string | null;
  lengthCm?: number | string | null;
  widthCm?: number | string | null;
  heightCm?: number | string | null;
}): ShippingDimensionValidationResult {
  const errors: Record<string, string> = {};
  if (data.isShippable === false) {
    return { valid: true, errors };
  }

  const weight = data.weightKg !== null && data.weightKg !== undefined && data.weightKg !== '' ? Number(data.weightKg) : NaN;
  const length = data.lengthCm !== null && data.lengthCm !== undefined && data.lengthCm !== '' ? Number(data.lengthCm) : NaN;
  const width = data.widthCm !== null && data.widthCm !== undefined && data.widthCm !== '' ? Number(data.widthCm) : NaN;
  const height = data.heightCm !== null && data.heightCm !== undefined && data.heightCm !== '' ? Number(data.heightCm) : NaN;

  if (!Number.isFinite(weight) || weight <= 0) {
    errors.weightKg = 'Weight (kg) is required and must be a positive number greater than 0.';
  }
  if (!Number.isFinite(length) || length <= 0) {
    errors.lengthCm = 'Length (cm) is required and must be a positive number greater than 0.';
  }
  if (!Number.isFinite(width) || width <= 0) {
    errors.widthCm = 'Width (cm) is required and must be a positive number greater than 0.';
  }
  if (!Number.isFinite(height) || height <= 0) {
    errors.heightCm = 'Height (cm) is required and must be a positive number greater than 0.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Checks if a parcel (L, W, H) fits into vehicle cargo space (cargoL, cargoW, cargoH)

 * with any of the 6 orthogonal 3D orientations.
 */
export function fitsInCargoSpace(
  parcelL: number,
  parcelW: number,
  parcelH: number,
  cargoL: number,
  cargoW: number,
  cargoH: number
): boolean {
  if (cargoL <= 0 || cargoW <= 0 || cargoH <= 0) return false;
  const p = [parcelL, parcelW, parcelH].sort((a, b) => a - b);
  const c = [cargoL, cargoW, cargoH].sort((a, b) => a - b);
  return p[0] <= c[0] && p[1] <= c[1] && p[2] <= c[2];
}

/**
 * Validates whether a complete set of shipment items physically fits into a vehicle's cargo space
 * based on actual product dimensions, quantities, total weight, and usable cargo L x W x H.
 */
export function canShipmentFitInVehicle(
  items: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number; weightKg: number; name?: string }>,
  vehicle: { capacityKg: number; cargoLengthCm: number; cargoWidthCm: number; cargoHeightCm: number; vehicleType?: string }
): { fits: boolean; reason?: string } {
  const capKg = Number(vehicle.capacityKg) || 0;
  const cargoL = Number(vehicle.cargoLengthCm) || 0;
  const cargoW = Number(vehicle.cargoWidthCm) || 0;
  const cargoH = Number(vehicle.cargoHeightCm) || 0;

  if (cargoL <= 0 || cargoW <= 0 || cargoH <= 0 || capKg <= 0) {
    return { fits: false, reason: 'Vehicle cargo dimensions or weight capacity not configured.' };
  }

  // 1. Total Weight Check
  const totalWeight = items.reduce((sum, it) => sum + (Number(it.weightKg) || 0), 0);
  if (totalWeight > capKg) {
    return { fits: false, reason: `Total cargo weight (${totalWeight} kg) exceeds vehicle payload capacity (${capKg} kg).` };
  }

  // 2. Individual Item Fit Check
  for (const it of items) {
    const l = Number(it.lengthCm) || 0;
    const w = Number(it.widthCm) || 0;
    const h = Number(it.heightCm) || 0;
    if (l <= 0 || w <= 0 || h <= 0) {
      return { fits: false, reason: `Item "${it.name || 'Product'}" has missing or zero dimensions (${l} × ${w} × ${h} cm).` };
    }
    if (!fitsInCargoSpace(l, w, h, cargoL, cargoW, cargoH)) {
      return {
        fits: false,
        reason: `Item dimension (${l} × ${w} × ${h} cm) exceeds vehicle usable cargo space (${cargoL} × ${cargoW} × ${cargoH} cm).`
      };
    }
  }

  // 3. Combined Cargo Volume Check (allow max 90% usable space utilization)
  const totalItemVolume = items.reduce((sum, it) => {
    const q = Math.max(1, Number(it.quantity) || 1);
    return sum + (Number(it.lengthCm) * Number(it.widthCm) * Number(it.heightCm) * q);
  }, 0);
  const vehicleVolume = cargoL * cargoW * cargoH;
  if (totalItemVolume > vehicleVolume * 0.90) {
    return {
      fits: false,
      reason: `Total cargo volume (${Math.round(totalItemVolume)} cm³) exceeds usable vehicle volume (${Math.round(vehicleVolume * 0.90)} cm³).`
    };
  }

  // 4. Physical 3D Layout & Arrangement Check
  const expandedItems: Array<{ l: number; w: number; h: number }> = [];
  for (const it of items) {
    const q = Math.max(1, Number(it.quantity) || 1);
    for (let i = 0; i < q; i++) {
      expandedItems.push({
        l: Number(it.lengthCm),
        w: Number(it.widthCm),
        h: Number(it.heightCm),
      });
    }
  }

  if (expandedItems.length <= 1) {
    return { fits: true };
  }

  // Arrangement Option A: End-to-end length arrangement
  const sumLength = expandedItems.reduce((sum, it) => sum + Math.max(it.l, it.w), 0);
  const maxFootprintW = Math.max(...expandedItems.map(it => Math.min(it.l, it.w)));
  const maxFootprintH = Math.max(...expandedItems.map(it => it.h));
  if (sumLength <= cargoL && maxFootprintW <= cargoW && maxFootprintH <= cargoH) {
    return { fits: true };
  }

  // Arrangement Option B: Side-by-side width arrangement
  const sumWidth = expandedItems.reduce((sum, it) => sum + Math.min(it.l, it.w), 0);
  const maxFootprintL = Math.max(...expandedItems.map(it => Math.max(it.l, it.w)));
  if (maxFootprintL <= cargoL && sumWidth <= cargoW && maxFootprintH <= cargoH) {
    return { fits: true };
  }

  // Arrangement Option C: 3D bounding box package fit
  const packed = calculatePackedParcelDimensions(items);
  if (fitsInCargoSpace(packed.lengthCm, packed.widthCm, packed.heightCm, cargoL, cargoW, cargoH)) {
    return { fits: true };
  }

  return {
    fits: false,
    reason: `Items cannot be arranged together within vehicle cargo space (${cargoL} × ${cargoW} × ${cargoH} cm).`
  };
}


/**
 * Packs multiple items into a combined realistic 3D parcel bounding box (Length, Width, Height in cm)
 * without naive multiplication of all dimensions by quantity.
 */
export function calculatePackedParcelDimensions(
  items: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number }>
): { lengthCm: number; widthCm: number; heightCm: number; totalVolumeCm3: number } {
  if (!items || items.length === 0) {
    return { lengthCm: 0, widthCm: 0, heightCm: 0, totalVolumeCm3: 0 };
  }

  let maxSingleL = 0;
  let maxSingleW = 0;
  let maxSingleH = 0;
  let totalNetVolumeCm3 = 0;

  for (const it of items) {
    const l = Math.max(0.1, Number(it.lengthCm) || 0.1);
    const w = Math.max(0.1, Number(it.widthCm) || 0.1);
    const h = Math.max(0.1, Number(it.heightCm) || 0.1);
    const q = Math.max(1, Number(it.quantity) || 1);

    maxSingleL = Math.max(maxSingleL, l);
    maxSingleW = Math.max(maxSingleW, w);
    maxSingleH = Math.max(maxSingleH, h);
    totalNetVolumeCm3 += (l * w * h) * q;
  }

  const totalPieces = items.reduce((sum, it) => sum + Math.max(1, Number(it.quantity) || 1), 0);
  if (totalPieces === 1) {
    const single = items[0];
    const l = Math.round(Number(single.lengthCm) * 100) / 100;
    const w = Math.round(Number(single.widthCm) * 100) / 100;
    const h = Math.round(Number(single.heightCm) * 100) / 100;
    return {
      lengthCm: l,
      widthCm: w,
      heightCm: h,
      totalVolumeCm3: Math.round(l * w * h),
    };
  }

  // Single SKU multiple pieces: find optimal grid stacking
  if (items.length === 1) {
    const it = items[0];
    const n = Math.max(1, Number(it.quantity) || 1);
    const l = Number(it.lengthCm);
    const w = Number(it.widthCm);
    const h = Number(it.heightCm);

    let bestL = l * n;
    let bestW = w;
    let bestH = h;
    let bestScore = Infinity;

    for (let nx = 1; nx <= n; nx++) {
      for (let ny = 1; ny <= Math.ceil(n / nx); ny++) {
        const nz = Math.ceil(n / (nx * ny));
        if (nx * ny * nz >= n) {
          const candL = nx * l;
          const candW = ny * w;
          const candH = nz * h;
          // Prefer compact, cubic aspect ratios and minimal maximum dimension
          const maxDim = Math.max(candL, candW, candH);
          const score = maxDim * 100000 + (candL * candW * candH);
          if (score < bestScore) {
            bestScore = score;
            bestL = candL;
            bestW = candW;
            bestH = candH;
          }
        }
      }
    }

    return {
      lengthCm: Math.round(bestL * 100) / 100,
      widthCm: Math.round(bestW * 100) / 100,
      heightCm: Math.round(bestH * 100) / 100,
      totalVolumeCm3: Math.round(bestL * bestW * bestH),
    };
  }

  // Multi-SKU items: realistic 3D bounding box with 85% packing efficiency
  const grossVolume = totalNetVolumeCm3 / 0.85;
  const baseArea = Math.max(maxSingleL * maxSingleW, 100);
  let estHeight = Math.max(maxSingleH, Math.ceil(grossVolume / baseArea));
  let estLength = Math.max(maxSingleL, Math.round(Math.pow(grossVolume, 1 / 3) * (maxSingleL / Math.max(maxSingleW, 1))));
  let estWidth = Math.max(maxSingleW, Math.ceil(grossVolume / (estLength * estHeight)));

  if (estLength * estWidth * estHeight < totalNetVolumeCm3) {
    estHeight = Math.ceil(totalNetVolumeCm3 / (estLength * estWidth));
  }

  return {
    lengthCm: Math.round(estLength * 100) / 100,
    widthCm: Math.round(estWidth * 100) / 100,
    heightCm: Math.round(estHeight * 100) / 100,
    totalVolumeCm3: Math.round(estLength * estWidth * estHeight),
  };
}

/**
 * Classifies a packed parcel into configured package categories from database
 */
export async function classifyPackageCategory(
  packedL: number,
  packedW: number,
  packedH: number,
  weightKg: number
): Promise<PackageCategoryResult> {
  try {
    const categories = await db
      .select()
      .from(packageCategories)
      .where(eq(packageCategories.isActive, true))
      .orderBy(packageCategories.sortOrder);

    const parcelSorted = [packedL, packedW, packedH].sort((a, b) => a - b);

    for (const cat of categories) {
      const maxL = Number(cat.maxLengthCm || 99999);
      const maxW = Number(cat.maxWidthCm || 99999);
      const maxH = Number(cat.maxHeightCm || 99999);
      const maxWt = Number(cat.maxWeightKg || 99999);

      const catSorted = [maxL, maxW, maxH].sort((a, b) => a - b);

      if (
        weightKg <= maxWt &&
        parcelSorted[0] <= catSorted[0] &&
        parcelSorted[1] <= catSorted[1] &&
        parcelSorted[2] <= catSorted[2]
      ) {
        const rangeDescription = `Up to ${maxWt} kg | Max ${maxL} × ${maxW} × ${maxH} cm`;
        return { 
          code: cat.code, 
          name: cat.name, 
          description: cat.description || rangeDescription,
          rangeDescription,
          isExceeded: false 
        };
      }
    }
  } catch (err) {
    console.warn('Unable to query package_categories from DB, falling back to static thresholds:', err);
  }

  // Fallback static thresholds
  if (weightKg <= 3 && Math.max(packedL, packedW, packedH) <= 25) {
    return { 
      code: 'SMALL', 
      name: 'Small', 
      description: 'Up to 3 kg | Max 25 × 20 × 10 cm (Pouches, small cosmetics, documents)', 
      rangeDescription: 'Up to 3 kg | Max 25 × 20 × 10 cm',
      isExceeded: false 
    };
  }
  if (weightKg <= 10 && Math.max(packedL, packedW, packedH) <= 40) {
    return { 
      code: 'MEDIUM', 
      name: 'Med', 
      description: 'Up to 10 kg | Max 40 × 30 × 20 cm (Shoeboxes, folded clothes, small electronics)', 
      rangeDescription: 'Up to 10 kg | Max 40 × 30 × 20 cm',
      isExceeded: false 
    };
  }
  if (weightKg <= 25 && Math.max(packedL, packedW, packedH) <= 60) {
    return { 
      code: 'LARGE', 
      name: 'Large', 
      description: 'Up to 25 kg | Max 60 × 45 × 35 cm (Microwaves, bulk groceries, kitchen appliances)', 
      rangeDescription: 'Up to 25 kg | Max 60 × 45 × 35 cm',
      isExceeded: false 
    };
  }
  if (weightKg <= 50 && Math.max(packedL, packedW, packedH) <= 100) {
    return { 
      code: 'EXTRA_LARGE', 
      name: 'XL', 
      description: 'Up to 50 kg | Max 100 × 70 × 60 cm (TVs, medium furniture, multi-item cartons)', 
      rangeDescription: 'Up to 50 kg | Max 100 × 70 × 60 cm',
      isExceeded: false 
    };
  }
  if (weightKg <= 200 && Math.max(packedL, packedW, packedH) <= 180) {
    return { 
      code: 'OVERSIZED', 
      name: 'Oversized', 
      description: 'Up to 200 kg | Max 180 × 120 × 100 cm (Refrigerators, commercial gym gear, crates)', 
      rangeDescription: 'Up to 200 kg | Max 180 × 120 × 100 cm',
      isExceeded: false 
    };
  }

  return { 
    code: 'FREIGHT_CARGO', 
    name: 'Freight / Cargo', 
    description: 'Above 200 kg or >180 cm (Palletized cargo, industrial equipment, construction materials)', 
    rangeDescription: 'Above 200 kg or >180 cm',
    isExceeded: true 
  };
}

/**
 * Haversine formula with road winding factor (1.3)
 */
export function calculateHaversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return c * R * 1.3;
}

/**
 * Authoritative Server-side Delivery Quote & Vehicle Selection Engine
 * With Required Product Dimensions, Cargo Space Verification, and ZERO Vehicle Base Fee
 */
export async function calculateDeliveryQuote(
  params: DeliveryCalculationParams
): Promise<DeliveryCalculationResult> {
  const { items, tenantId, dropoffLat, dropoffLng, priority = 'STANDARD', customDistanceKm, courierCode } = params;

  const emptyPacked = { lengthCm: 0, widthCm: 0, heightCm: 0, totalVolumeCm3: 0 };
  const emptyCategory = { code: 'SMALL', name: 'Small', isExceeded: false };

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'No items provided for calculation.',
      totalQuota: 0,
      totalWeightKg: 0,
      distanceKm: 0,
      itemsSubtotal: 0,
      grandTotal: 0,
      packedDimensions: emptyPacked,
      packageCategory: emptyCategory,
      itemBreakdown: [],
    };
  }

  // 1. Fetch Tenant (Origin) Details
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
  if (!tenant) {
    return {
      success: false,
      error: `Store / Business not found for Tenant ID ${tenantId}.`,
      totalQuota: 0,
      totalWeightKg: 0,
      distanceKm: 0,
      itemsSubtotal: 0,
      grandTotal: 0,
      packedDimensions: emptyPacked,
      packageCategory: emptyCategory,
      itemBreakdown: [],
    };
  }

  // 2. Fetch authoritative product variants, parent products, and selling units
  const variantIds = items.map(i => i.variantId || i.productId).filter(Boolean);
  const dbVariants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      name: productVariants.name,
      price: productVariants.price,
      weightKg: productVariants.weightKg,
      weightPerPieceKg: productVariants.weightPerPieceKg,
      weight: productVariants.weight,
      lengthCm: productVariants.lengthCm,
      widthCm: productVariants.widthCm,
      heightCm: productVariants.heightCm,
      quota: productVariants.quota,
      unit: productVariants.unit,
      parentName: products.name,
      parentStatus: products.status,
      parentWeightKg: products.weightKg,
      parentLengthCm: products.lengthCm,
      parentWidthCm: products.widthCm,
      parentHeightCm: products.heightCm,
      isShippable: products.isShippable,
    })
    .from(productVariants)
    .innerJoin(products, eq(productVariants.productId, products.id))
    .where(inArray(productVariants.id, variantIds));

  const variantMap = new Map<number, typeof dbVariants[0]>();
  for (const v of dbVariants) {
    variantMap.set(v.id, v);
  }

  const sellingUnitIds = items.map(i => i.sellingUnitId).filter(Boolean) as number[];
  const productIds = Array.from(new Set(Array.from(variantMap.values()).map(v => v.productId)));
  const dbSellingUnits = (sellingUnitIds.length > 0 || productIds.length > 0)
    ? await db
        .select()
        .from(productSellingUnits)
        .where(
          sellingUnitIds.length > 0
            ? inArray(productSellingUnits.id, sellingUnitIds)
            : inArray(productSellingUnits.productId, productIds)
        )
    : [];

  const sellingUnitMap = new Map<number, typeof dbSellingUnits[0]>();
  for (const su of dbSellingUnits) {
    sellingUnitMap.set(su.id, su);
  }

  // 3. Calculate Item Weight, Quotas, Subtotals, Physical Dimensions, and Validate
  const validationErrors: string[] = [];
  const itemBreakdown: ItemBreakdown[] = [];
  const packingItems: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number }> = [];

  let totalQuota = 0;
  let totalWeightKg = 0;
  let itemsSubtotal = 0;

  for (const item of items) {
    const vId = item.variantId || item.productId;
    const variant = variantMap.get(vId);

    if (!variant) {
      validationErrors.push(`Product variant (ID: ${vId}) was not found in database.`);
      continue;
    }

    if (!item.quantity || item.quantity <= 0) {
      validationErrors.push(`Invalid quantity (${item.quantity}) for product "${variant.parentName} - ${variant.name}". Positive quantity required.`);
      continue;
    }

    let unitName = variant.unit || 'piece';
    let unitPrice = Number(variant.price || 0);

    // Resolve Physical Dimensions & Weight with Inheritance:
    // Selling Unit -> Variant -> Parent Product
    const baseUnitWeightKg = Number(
      variant.weightKg || variant.weightPerPieceKg || variant.parentWeightKg || variant.weight || 0
    );
    let lengthCm = Number(variant.lengthCm || variant.parentLengthCm || 0);
    let widthCm = Number(variant.widthCm || variant.parentWidthCm || 0);
    let heightCm = Number(variant.heightCm || variant.parentHeightCm || 0);

    let equivUnits = 1;
    let singleItemWeightKg = baseUnitWeightKg;

    let su = item.sellingUnitId ? sellingUnitMap.get(item.sellingUnitId) : null;
    if (!su && (item as any).unit) {
      su = Array.from(sellingUnitMap.values()).find(
        u => u.productId === variant.productId && u.unitName.trim().toLowerCase() === String((item as any).unit).trim().toLowerCase()
      );
    }

    if (su) {
      unitName = su.unitName;
      unitPrice = Number(su.price ?? variant.price ?? 0);
      equivUnits = Number(su.equivalentQty) || 1;

      if (su.weightKg && Number(su.weightKg) > 0) {
        singleItemWeightKg = Number(su.weightKg);
      } else if (su.weight && Number(su.weight) > 0) {
        singleItemWeightKg = Number(su.weight);
      } else {
        singleItemWeightKg = baseUnitWeightKg * equivUnits;
      }

      if (su.lengthCm && Number(su.lengthCm) > 0) lengthCm = Number(su.lengthCm);
      if (su.widthCm && Number(su.widthCm) > 0) widthCm = Number(su.widthCm);
      if (su.heightCm && Number(su.heightCm) > 0) heightCm = Number(su.heightCm);
    }

    // Graceful Fallback: For shippable products with positive weight whose dimensions
    // are missing or zero, infer standard package tier dimensions by weight
    if (variant.isShippable !== false && singleItemWeightKg > 0) {
      const hasMissingDims =
        !Number.isFinite(lengthCm) || lengthCm <= 0 ||
        !Number.isFinite(widthCm) || widthCm <= 0 ||
        !Number.isFinite(heightCm) || heightCm <= 0;

      if (hasMissingDims) {
        if (singleItemWeightKg <= 3) {
          if (!lengthCm || lengthCm <= 0) lengthCm = 25;
          if (!widthCm || widthCm <= 0) widthCm = 20;
          if (!heightCm || heightCm <= 0) heightCm = 10;
        } else if (singleItemWeightKg <= 10) {
          if (!lengthCm || lengthCm <= 0) lengthCm = 40;
          if (!widthCm || widthCm <= 0) widthCm = 30;
          if (!heightCm || heightCm <= 0) heightCm = 20;
        } else if (singleItemWeightKg <= 25) {
          if (!lengthCm || lengthCm <= 0) lengthCm = 60;
          if (!widthCm || widthCm <= 0) widthCm = 45;
          if (!heightCm || heightCm <= 0) heightCm = 35;
        } else if (singleItemWeightKg <= 50) {
          if (!lengthCm || lengthCm <= 0) lengthCm = 100;
          if (!widthCm || widthCm <= 0) widthCm = 70;
          if (!heightCm || heightCm <= 0) heightCm = 60;
        } else if (singleItemWeightKg <= 200) {
          if (!lengthCm || lengthCm <= 0) lengthCm = 180;
          if (!widthCm || widthCm <= 0) widthCm = 120;
          if (!heightCm || heightCm <= 0) heightCm = 100;
        } else {
          if (!lengthCm || lengthCm <= 0) lengthCm = 200;
          if (!widthCm || widthCm <= 0) widthCm = 150;
          if (!heightCm || heightCm <= 0) heightCm = 120;
        }
      }
    }

    // Weight is quantity * singleItemWeightKg (Quota represents quantity evaluated, NOT a weight multiplier)
    const itemWeight = Math.round(item.quantity * singleItemWeightKg * 100) / 100;
    const itemQuota = item.quantity * equivUnits;

    // Strict Validation: Shippable products must have positive numeric weight and all 3 dimensions
    if (variant.isShippable !== false) {
      if (!Number.isFinite(singleItemWeightKg) || singleItemWeightKg <= 0) {
        validationErrors.push(
          `Product "${variant.parentName} - ${variant.name}" has missing or zero weight (${singleItemWeightKg} kg). Actual weight in kg is mandatory for all shippable items.`
        );
      }
      if (!Number.isFinite(lengthCm) || lengthCm <= 0) {
        validationErrors.push(
          `Product "${variant.parentName} - ${variant.name}" has missing or zero length (${lengthCm} cm). Length in cm is mandatory for shipping.`
        );
      }
      if (!Number.isFinite(widthCm) || widthCm <= 0) {
        validationErrors.push(
          `Product "${variant.parentName} - ${variant.name}" has missing or zero width (${widthCm} cm). Width in cm is mandatory for shipping.`
        );
      }
      if (!Number.isFinite(heightCm) || heightCm <= 0) {
        validationErrors.push(
          `Product "${variant.parentName} - ${variant.name}" has missing or zero height (${heightCm} cm). Height in cm is mandatory for shipping.`
        );
      }
    }

    if (!Number.isFinite(itemQuota) || itemQuota <= 0) {
      validationErrors.push(
        `Product "${variant.parentName} - ${variant.name}" has an invalid product quantity requirement.`
      );
    }

    const lineTotal = item.quantity * unitPrice;
    itemsSubtotal += lineTotal;
    totalQuota += itemQuota;
    totalWeightKg += itemWeight;

    itemBreakdown.push({
      productId: variant.productId,
      variantId: variant.id,
      productName: variant.parentName,
      variantName: variant.name,
      unit: unitName,
      quantity: item.quantity,
      quota: itemQuota,
      weightPerQuotaKg: singleItemWeightKg,
      itemWeightKg: Math.round(itemWeight * 100) / 100,
      lengthCm,
      widthCm,
      heightCm,
      unitPrice,
      lineTotal,
    });

    packingItems.push({
      lengthCm,
      widthCm,
      heightCm,
      quantity: item.quantity,
    });
  }

  // Calculate packed parcel 3D dimensions
  const packedDimensions = calculatePackedParcelDimensions(packingItems);
  totalWeightKg = Math.round(totalWeightKg * 100) / 100;
  const packageCategory = await classifyPackageCategory(
    packedDimensions.lengthCm,
    packedDimensions.widthCm,
    packedDimensions.heightCm,
    totalWeightKg
  );

  if (validationErrors.length > 0) {
    return {
      success: false,
      error: validationErrors.join(' | '),
      validationErrors,
      totalQuota,
      totalWeightKg,
      distanceKm: 0,
      itemsSubtotal,
      grandTotal: itemsSubtotal,
      packedDimensions,
      packageCategory,
      itemBreakdown,
    };
  }

  // 4. Calculate Billable Distance
  let distanceKm = 0;
  if (customDistanceKm !== undefined && customDistanceKm !== null && customDistanceKm > 0) {
    distanceKm = customDistanceKm;
  } else if (
    dropoffLat !== null &&
    dropoffLat !== undefined &&
    dropoffLng !== null &&
    dropoffLng !== undefined &&
    tenant.lat &&
    tenant.lng
  ) {
    distanceKm = calculateHaversineDistanceKm(
      Number(tenant.lat),
      Number(tenant.lng),
      dropoffLat,
      dropoffLng
    );
  } else {
    return {
      success: false,
      error: 'Delivery destination coordinates are missing or invalid.',
      totalQuota,
      totalWeightKg,
      distanceKm: 0,
      itemsSubtotal,
      grandTotal: itemsSubtotal,
      packedDimensions,
      packageCategory,
      itemBreakdown,
    };
  }

  distanceKm = Math.max(1.0, Math.round(distanceKm * 100) / 100);

  // 5. Query Configured Platform Vehicle Classes & Fleet (Using Super Admin Delivery Pricing)
  const configuredRates = await getActiveDeliveryRates();

  if (configuredRates.length === 0) {
    return {
      success: false,
      error: 'No active vehicle classes are configured in Super Admin Delivery Pricing.',
      totalQuota,
      totalWeightKg,
      distanceKm,
      itemsSubtotal,
      grandTotal: itemsSubtotal,
      packedDimensions,
      packageCategory,
      itemBreakdown,
      allEligibleVehicles: [],
    };
  }

  // Query registered fleet for physical vehicle instances (plate numbers / vehicle IDs)
  const registeredFleet = await db
    .select({
      id: vehicles.id,
      tenantId: vehicles.tenantId,
      deliveryPartnerId: vehicles.deliveryPartnerId,
      plateNumber: vehicles.plateNumber,
      vehicleType: vehicles.vehicleType,
      status: vehicles.status,
      capacityKg: vehicles.capacityKg,
      cargoLengthCm: vehicles.cargoLengthCm,
      cargoWidthCm: vehicles.cargoWidthCm,
      cargoHeightCm: vehicles.cargoHeightCm,
    })
    .from(vehicles)
    .where(eq(vehicles.status, 'ACTIVE'));

  // Build the complete evaluatable vehicle candidates from Super Admin configured classes
  const candidateVehicles = configuredRates.map(rate => {
    const normalize = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const rateNorm = normalize(rate.vehicleType);

    // Check if tenant or platform has physical vehicle(s) registered for this class
    const matchingPhysical = registeredFleet.find(
      rf => normalize(rf.vehicleType) === rateNorm && (rf.tenantId === tenantId || !rf.tenantId)
    ) || registeredFleet.find(
      rf => normalize(rf.vehicleType) === rateNorm
    ) || registeredFleet.find(
      rf => {
        const rfNorm = normalize(rf.vehicleType);
        return (
          rfNorm.includes(rateNorm) ||
          rateNorm.includes(rfNorm) ||
          (rateNorm.includes('travi') && rfNorm.includes('travi')) ||
          (rateNorm.includes('motor') && rfNorm.includes('motor')) ||
          (rateNorm.includes('pickup') && rfNorm.includes('pickup')) ||
          (rateNorm.includes('truck') && rfNorm.includes('truck'))
        ) && (rf.tenantId === tenantId || !rf.tenantId);
      }
    ) || registeredFleet.find(
      rf => {
        const rfNorm = normalize(rf.vehicleType);
        return (
          rfNorm.includes(rateNorm) ||
          rateNorm.includes(rfNorm) ||
          (rateNorm.includes('travi') && rfNorm.includes('travi')) ||
          (rateNorm.includes('motor') && rfNorm.includes('motor')) ||
          (rateNorm.includes('pickup') && rfNorm.includes('pickup')) ||
          (rateNorm.includes('truck') && rfNorm.includes('truck'))
        );
      }
    );

    // CRITICAL: The Super Admin configured vehicle delivery rates are the authoritative source
    // for payload capacity, dimensions, and per-km pricing.
    const capKg = Number(rate.capacityKg || 0);
    const length = Number(rate.cargoLengthCm || 0);
    const width = Number(rate.cargoWidthCm || 0);
    const height = Number(rate.cargoHeightCm || 0);

    return {
      id: matchingPhysical ? matchingPhysical.id : null,
      physicalVehicleId: matchingPhysical ? matchingPhysical.id : null,
      rateId: rate.id,
      tenantId: matchingPhysical?.tenantId || tenantId,
      deliveryPartnerId: matchingPhysical?.deliveryPartnerId || null,
      plateNumber: matchingPhysical?.plateNumber || 'Fleet Available',
      vehicleType: rate.vehicleType,
      capacityKg: capKg,
      cargoLengthCm: length,
      cargoWidthCm: width,
      cargoHeightCm: height,
      pricePerKm: Number(rate.pricePerKm || 0),
    };
  });

  // Filter eligible vehicles:
  // 1. Payload Capacity: totalWeightKg <= vehicle.capacityKg
  // 2. Cargo 3D Usable Dimensions: all items physically fit & arrange inside cargo space
  const eligibleVehicles = candidateVehicles
    .filter(v => {
      const fitResult = canShipmentFitInVehicle(
        packingItems.map((pi, idx) => ({
          ...pi,
          weightKg: itemBreakdown[idx]?.itemWeightKg || 0,
          name: itemBreakdown[idx]?.productName || 'Item'
        })),
        {
          capacityKg: v.capacityKg,
          cargoLengthCm: v.cargoLengthCm,
          cargoWidthCm: v.cargoWidthCm,
          cargoHeightCm: v.cargoHeightCm,
          vehicleType: v.vehicleType
        }
      );
      return fitResult.fits;
    })
    .sort((a, b) => {
      // Helper: Capacity class tiers (avoid dispatching a heavy truck or pickup for a motorcycle-sized order)
      const getCapacityTier = (cap: number) => {
        if (cap <= 35) return 1; // Motorcycle / Scooter / Two-wheeler
        if (cap <= 300) return 2; // Small Van / MPV / Light Traviz
        if (cap <= 1500) return 3; // Pickup / Large Van
        if (cap <= 5000) return 4; // 4-Wheeler / 6-Wheeler Light Truck
        return 5; // Heavy Truck / 10-Wheeler
      };

      // 1. Prefer smaller suitable vehicle class tier (two-wheeler before pickup before heavy truck)
      const tierDiff = getCapacityTier(a.capacityKg) - getCapacityTier(b.capacityKg);
      if (tierDiff !== 0) return tierDiff;

      // 2. Within the same vehicle class tier, choose the most economical per-km rate
      const rateDiff = a.pricePerKm - b.pricePerKm;
      if (rateDiff !== 0) return rateDiff;

      // 3. Sort by payload capacity ascending
      const capDiff = a.capacityKg - b.capacityKg;
      if (capDiff !== 0) return capDiff;

      // 4. Sort by cargo space volume ascending
      const volA = a.cargoLengthCm * a.cargoWidthCm * a.cargoHeightCm;
      const volB = b.cargoLengthCm * b.cargoWidthCm * b.cargoHeightCm;
      return volA - volB;
    });

  if (eligibleVehicles.length === 0) {
    // Check whether failure was due to weight, dimensions, or both
    const weightMatches = candidateVehicles.filter(v => v.capacityKg >= totalWeightKg);
    let reason = '';
    if (weightMatches.length === 0) {
      const maxCap = Math.max(...candidateVehicles.map(v => v.capacityKg), 0);
      reason = `Total cargo weight (${totalWeightKg} kg) exceeds maximum configured vehicle capacity (${maxCap} kg). No vehicle in Super Admin delivery pricing can carry this load.`;
    } else {
      reason = `Packed parcel dimensions (${packedDimensions.lengthCm} × ${packedDimensions.widthCm} × ${packedDimensions.heightCm} cm) exceed the cargo space of all vehicles meeting the ${totalWeightKg} kg capacity requirement.`;
    }

    return {
      success: false,
      error: `${reason} No configured vehicle can accommodate this shipment. Please adjust quantity or select a freight method.`,
      totalQuota,
      totalWeightKg,
      distanceKm,
      itemsSubtotal,
      grandTotal: itemsSubtotal,
      packedDimensions,
      packageCategory,
      itemBreakdown,
      allEligibleVehicles: [],
    };
  }

  // Select smallest available vehicle that fits both weight and dimensions
  const selectedVehicle = eligibleVehicles[0];

  // 6. Pricing Rules Calculation (Distance + Chargeable Weight/Size Pricing with ZERO Vehicle Base Fee)
  const [platformSettings] = await db
    .select()
    .from(platformDeliverySettings)
    .orderBy(desc(platformDeliverySettings.updatedAt))
    .limit(1);

  const pricePerKm = selectedVehicle.pricePerKm > 0
    ? selectedVehicle.pricePerKm
    : Number(platformSettings?.pricePerKm || 20);

  // Distance fee is the distance multiplied by per-km rate (strictly NO vehicle base fee!)
  const distanceFee = Math.round(distanceKm * pricePerKm * 100) / 100;

  // Weight & Size (Shopee / TikTok style volumetric calculation)
  // 1. Actual weight is total cargo weight in kg
  const actualWeightKg = Math.max(0.01, Math.round(totalWeightKg * 100) / 100);

  // 2. Volumetric weight = (Length * Width * Height in cm) / Volumetric Divisor (default: 5000)
  const divisor = Math.max(1, Number(platformSettings?.volumetricDivisor || 5000));
  const rawVolumetric = (packedDimensions.lengthCm * packedDimensions.widthCm * packedDimensions.heightCm) / divisor;
  const volumetricWeightKg = Math.round(rawVolumetric * 100) / 100;

  // 3. Chargeable weight is the greater of actual weight and volumetric weight
  const chargeableWeightKg = Math.round(Math.max(actualWeightKg, volumetricWeightKg) * 100) / 100;

  // 4. Weight Pricing Rules
  const baseWeightKg = Math.max(0, Number(platformSettings?.baseWeightKg ?? 1.0));
  const baseWeightPrice = Math.max(0, Number(platformSettings?.baseWeightPrice ?? 0.0));
  const incrementalRate = Math.max(0, Number(platformSettings?.incrementalWeightRate ?? 10.0));

  // Additional weight beyond base weight
  const excessWeightKg = Math.max(0, chargeableWeightKg - baseWeightKg);
  const incrementalWeightFee = Math.round(excessWeightKg * incrementalRate * 100) / 100;
  const totalWeightFee = Math.round((baseWeightPrice + incrementalWeightFee) * 100) / 100;

  // Normal Delivery Fee combines distance fee + weight/size fee (strictly NO vehicle base fee)
  const normalDeliveryFee = Math.round((distanceFee + totalWeightFee) * 100) / 100;
  const urgentFee = priority === 'URGENT' ? Number(platformSettings?.urgentDeliveryFee || 0) : 0;
  const totalShippingFee = Math.round((normalDeliveryFee + urgentFee) * 100) / 100;
  const grandTotal = Math.round((itemsSubtotal + totalShippingFee) * 100) / 100;

  return {
    success: true,
    totalQuota,
    totalWeightKg,
    distanceKm,
    itemsSubtotal: Math.round(itemsSubtotal * 100) / 100,
    packedDimensions,
    packageCategory,
    vehicle: {
      id: selectedVehicle.id,
      physicalVehicleId: selectedVehicle.physicalVehicleId || null,
      plateNumber: selectedVehicle.plateNumber,
      vehicleType: selectedVehicle.vehicleType,
      capacityKg: selectedVehicle.capacityKg,
      cargoLengthCm: selectedVehicle.cargoLengthCm,
      cargoWidthCm: selectedVehicle.cargoWidthCm,
      cargoHeightCm: selectedVehicle.cargoHeightCm,
      tenantId: selectedVehicle.tenantId,
    },
    pricing: {
      vehicleType: selectedVehicle.vehicleType,
      basePrice: 0, // strictly 0
      pricePerKm,
      distanceFee,
      actualWeightKg,
      volumetricWeightKg,
      chargeableWeightKg,
      baseWeightKg,
      baseWeightFee: baseWeightPrice,
      weightFee: totalWeightFee,
      normalDeliveryFee,
      urgentFee,
      totalShippingFee,
    },
    grandTotal,
    itemBreakdown,
    allEligibleVehicles: eligibleVehicles.map(v => ({
      id: v.id,
      physicalVehicleId: v.physicalVehicleId || null,
      plateNumber: v.plateNumber,
      vehicleType: v.vehicleType,
      capacityKg: v.capacityKg,
      cargoLengthCm: v.cargoLengthCm,
      cargoWidthCm: v.cargoWidthCm,
      cargoHeightCm: v.cargoHeightCm,
    })),
    shippingRateDetails: {
      rateType: 'OWN_FLEET',
      distanceKm,
      pricePerKm,
      distanceFee,
      actualWeightKg,
      volumetricWeightKg,
      chargeableWeightKg,
      volumetricDivisor: divisor,
      baseWeightKg,
      baseWeightPrice,
      incrementalWeightRate: incrementalRate,
      weightFee: totalWeightFee,
      urgentFee,
      totalShippingFee,
      packageCategory: packageCategory.code,
      packedDimensions,
      vehicleType: selectedVehicle.vehicleType,
    },
  };
}

let cachedRates: any[] | null = null;
let cachedRatesTime = 0;
const RATES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getActiveDeliveryRates() {
  const now = Date.now();
  if (cachedRates && (now - cachedRatesTime) < RATES_CACHE_TTL) {
    return cachedRates;
  }
  const rates = await db
    .select({
      id: vehicleDeliveryRates.id,
      vehicleType: vehicleDeliveryRates.vehicleType,
      capacityKg: vehicleDeliveryRates.capacityKg,
      cargoLengthCm: vehicleDeliveryRates.cargoLengthCm,
      cargoWidthCm: vehicleDeliveryRates.cargoWidthCm,
      cargoHeightCm: vehicleDeliveryRates.cargoHeightCm,
      pricePerKm: vehicleDeliveryRates.pricePerKm,
      isActive: vehicleDeliveryRates.isActive,
    })
    .from(vehicleDeliveryRates)
    .where(eq(vehicleDeliveryRates.isActive, true));

  cachedRates = rates;
  cachedRatesTime = now;
  return rates;
}

let cachedActiveVehicles: any[] | null = null;
let cachedVehiclesTime = 0;
const VEHICLES_CACHE_TTL = 30 * 1000; // 30 seconds

export async function getActiveVehiclesList() {
  const now = Date.now();
  if (cachedActiveVehicles && (now - cachedVehiclesTime) < VEHICLES_CACHE_TTL) {
    return cachedActiveVehicles;
  }
  const vList = await db.select({
    id: vehicles.id,
    plateNumber: vehicles.plateNumber,
    vehicleType: vehicles.vehicleType,
    capacityKg: vehicles.capacityKg,
    cargoLengthCm: vehicles.cargoLengthCm,
    cargoWidthCm: vehicles.cargoWidthCm,
    cargoHeightCm: vehicles.cargoHeightCm,
    tenantId: vehicles.tenantId,
    deliveryPartnerId: vehicles.deliveryPartnerId,
    status: vehicles.status,
  }).from(vehicles).where(eq(vehicles.status, 'ACTIVE'));

  cachedActiveVehicles = vList;
  cachedVehiclesTime = now;
  return vList;
}

export function clearVehicleDeliveryCache() {
  cachedRates = null;
  cachedRatesTime = 0;
  cachedActiveVehicles = null;
  cachedVehiclesTime = 0;
}

export async function determineVehicleForBatch(batchId: number, tenantId?: number | null) {
  // 1. Fetch batch, batchItems, and cached rates/active vehicles in parallel
  const [batchRows, batchItems, rates, allActiveVehicles] = await Promise.all([
    db.select().from(deliveryBatches).where(eq(deliveryBatches.id, batchId)),
    db.select().from(deliveryBatchItems).where(eq(deliveryBatchItems.batchId, batchId)),
    getActiveDeliveryRates(),
    getActiveVehiclesList()
  ]);

  const batch = batchRows[0];
  if (!batch) return null;

  const effectiveTenantId = tenantId || batch.tenantId;

  // 2. Fetch customer order IDs for this batch
  let orderIds = batchItems.map(b => b.customerOrderId).filter(Boolean);

  if (orderIds.length === 0) {
    const ordersInBatch = await db.select({ id: deliveryOrders.id }).from(deliveryOrders).where(eq(deliveryOrders.batchId, batchId));
    orderIds = ordersInBatch.map(o => o.id);
  }

  if (orderIds.length === 0) return null;

  // 3. Fetch all delivery items for these orders
  const rawItems = await db.execute(sql`
    SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.variant_id, di.product_name, di.unit, di.weight_kg as item_weight_kg,
      di.length_cm as item_length, di.width_cm as item_width, di.height_cm as item_height,
      pv.length_cm as var_length, pv.width_cm as var_width, pv.height_cm as var_height,
      pv.weight_per_piece_kg as var_weight_piece, pv.weight as var_weight_str,
      p.length_cm as prod_length, p.width_cm as prod_width, p.height_cm as prod_height,
      p.weight_kg as prod_weight_kg, p.name as prod_name
    FROM delivery_items di
    JOIN products p ON di.product_id = p.id
    JOIN product_variants pv ON di.variant_id = pv.id
    WHERE di.delivery_order_id IN (${sql.raw(orderIds.join(','))})
  `);

  let totalBatchWeight = 0;
  const packingItemsForBatch = (rawItems as any[]).map(r => {
    const qty = Number(r.quantity) || 1;
    const l = Number(r.var_length || r.prod_length || r.item_length) || 50;
    const w = Number(r.var_width || r.prod_width || r.item_width) || 40;
    const h = Number(r.var_height || r.prod_height || r.item_height) || 30;

    const varWeight = Number(r.var_weight_piece) || Number(r.var_weight_str) || 0;
    const prodWeight = Number(r.prod_weight_kg) || 0;

    let unitWeight = 0;
    if (varWeight > 0) unitWeight = varWeight;
    else if (prodWeight > 0) unitWeight = prodWeight;
    else if (Number(r.item_weight_kg) > 0) unitWeight = Number(r.item_weight_kg) / qty;

    const itemTotalWeight = unitWeight * qty;
    totalBatchWeight += itemTotalWeight;

    return {
      lengthCm: l,
      widthCm: w,
      heightCm: h,
      quantity: qty,
      weightKg: Math.round(itemTotalWeight * 100) / 100,
      name: r.product_name || r.prod_name || 'Item'
    };
  });

  const evaluatedVehicles = allActiveVehicles.map((v: any) => {
    const matchedRate = rates.find((r: any) => r.vehicleType.trim().toLowerCase() === v.vehicleType.trim().toLowerCase());
    const cap = v.capacityKg || matchedRate?.capacityKg || 1000;
    const l = Number(v.cargoLengthCm) || Number(matchedRate?.cargoLengthCm) || 0;
    const w = Number(v.cargoWidthCm) || Number(matchedRate?.cargoWidthCm) || 0;
    const h = Number(v.cargoHeightCm) || Number(matchedRate?.cargoHeightCm) || 0;

    const fit = canShipmentFitInVehicle(packingItemsForBatch, {
      capacityKg: cap,
      cargoLengthCm: l,
      cargoWidthCm: w,
      cargoHeightCm: h,
      vehicleType: v.vehicleType
    });

    return {
      ...v,
      capacityKg: cap,
      cargoLengthCm: l,
      cargoWidthCm: w,
      cargoHeightCm: h,
      fits: fit.fits,
      reason: fit.reason
    };
  });

  const eligibleVehicles = evaluatedVehicles.filter((v: any) => v.fits);
  eligibleVehicles.sort((a: any, b: any) => a.capacityKg - b.capacityKg);

  const tenantVehicles = eligibleVehicles.filter((v: any) => v.tenantId === effectiveTenantId);
  const bestVehicle = tenantVehicles[0] || eligibleVehicles[0] || null;

  // 5. Update DB batch record non-blocking
  if (bestVehicle && batch.suggestedVehicleId !== bestVehicle.id) {
    db.update(deliveryBatches)
      .set({
        suggestedVehicleId: bestVehicle.id,
        totalWeight: (Math.round(totalBatchWeight * 100) / 100).toFixed(2)
      })
      .where(eq(deliveryBatches.id, batchId))
      .catch((e) => console.error('Async batch vehicle suggestion update error:', e));

    if (orderIds.length > 0) {
      db.update(deliveryOrders)
        .set({
          suggestedVehicleId: bestVehicle.id,
          vehicleCapacityKg: bestVehicle.capacityKg,
          requiredVehicleType: bestVehicle.vehicleType,
          preferredVehicle: bestVehicle.vehicleType
        })
        .where(inArray(deliveryOrders.id, orderIds))
        .catch((e) => console.error('Async orders vehicle suggestion update error:', e));
    }
  }

  return {
    bestVehicle,
    totalWeight: Math.round(totalBatchWeight * 100) / 100,
    totalItems: packingItemsForBatch.reduce((sum, it) => sum + it.quantity, 0),
    packingItems: packingItemsForBatch,
    evaluatedVehicles
  };
}

export async function determineVehicleForDelivery(deliveryId: number, tenantId?: number | null) {
  const [orderRows, rawItems, rates, allActiveVehicles] = await Promise.all([
    db.select({
      id: deliveryOrders.id,
      tenantId: deliveryOrders.tenantId,
      suggestedVehicleId: deliveryOrders.suggestedVehicleId
    }).from(deliveryOrders).where(eq(deliveryOrders.id, deliveryId)),

    db.execute(sql`
      SELECT di.id, di.delivery_order_id, di.quantity, di.product_id, di.variant_id, di.product_name, di.unit, di.weight_kg as item_weight_kg,
        di.length_cm as item_length, di.width_cm as item_width, di.height_cm as item_height,
        pv.length_cm as var_length, pv.width_cm as var_width, pv.height_cm as var_height,
        pv.weight_per_piece_kg as var_weight_piece, pv.weight as var_weight_str,
        p.length_cm as prod_length, p.width_cm as prod_width, p.height_cm as prod_height,
        p.weight_kg as prod_weight_kg, p.name as prod_name
      FROM delivery_items di
      JOIN products p ON di.product_id = p.id
      JOIN product_variants pv ON di.variant_id = pv.id
      WHERE di.delivery_order_id = ${deliveryId}
         OR di.delivery_order_id IN (SELECT id FROM delivery_orders WHERE parent_order_id = ${deliveryId})
    `),

    getActiveDeliveryRates(),
    getActiveVehiclesList()
  ]);

  const order = orderRows[0];
  if (!order) return null;
  const effectiveTenantId = tenantId || order.tenantId;

  let totalDeliveryWeight = 0;
  const packingItems = (rawItems as any[]).map(r => {
    const qty = Number(r.quantity) || 1;
    const l = Number(r.var_length || r.prod_length || r.item_length) || 50;
    const w = Number(r.var_width || r.prod_width || r.item_width) || 40;
    const h = Number(r.var_height || r.prod_height || r.item_height) || 30;

    const varWeight = Number(r.var_weight_piece) || Number(r.var_weight_str) || 0;
    const prodWeight = Number(r.prod_weight_kg) || 0;

    let unitWeight = 0;
    if (varWeight > 0) unitWeight = varWeight;
    else if (prodWeight > 0) unitWeight = prodWeight;
    else if (Number(r.item_weight_kg) > 0) unitWeight = Number(r.item_weight_kg) / qty;

    const itemTotalWeight = unitWeight * qty;
    totalDeliveryWeight += itemTotalWeight;

    return {
      lengthCm: l,
      widthCm: w,
      heightCm: h,
      quantity: qty,
      weightKg: Math.round(itemTotalWeight * 100) / 100,
      name: r.product_name || r.prod_name || 'Item'
    };
  });

  const evaluatedVehicles = allActiveVehicles.map((v: any) => {
    const matchedRate = rates.find((r: any) => r.vehicleType.trim().toLowerCase() === v.vehicleType.trim().toLowerCase());
    const cap = v.capacityKg || matchedRate?.capacityKg || 1000;
    const l = Number(v.cargoLengthCm) || Number(matchedRate?.cargoLengthCm) || 0;
    const w = Number(v.cargoWidthCm) || Number(matchedRate?.cargoWidthCm) || 0;
    const h = Number(v.cargoHeightCm) || Number(matchedRate?.cargoHeightCm) || 0;

    const fit = canShipmentFitInVehicle(packingItems, {
      capacityKg: cap,
      cargoLengthCm: l,
      cargoWidthCm: w,
      cargoHeightCm: h,
      vehicleType: v.vehicleType
    });

    return {
      ...v,
      capacityKg: cap,
      cargoLengthCm: l,
      cargoWidthCm: w,
      cargoHeightCm: h,
      fits: fit.fits,
      reason: fit.reason
    };
  });

  const eligibleVehicles = evaluatedVehicles.filter((v: any) => v.fits);
  eligibleVehicles.sort((a: any, b: any) => a.capacityKg - b.capacityKg);

  const tenantVehicles = eligibleVehicles.filter((v: any) => v.tenantId === effectiveTenantId);
  const bestVehicle = tenantVehicles[0] || eligibleVehicles[0] || null;

  if (bestVehicle && order.suggestedVehicleId !== bestVehicle.id) {
    db.update(deliveryOrders)
      .set({
        suggestedVehicleId: bestVehicle.id,
        vehicleCapacityKg: bestVehicle.capacityKg,
        requiredVehicleType: bestVehicle.vehicleType,
        preferredVehicle: bestVehicle.vehicleType,
        totalWeight: (Math.round(totalDeliveryWeight * 100) / 100).toFixed(2)
      })
      .where(eq(deliveryOrders.id, deliveryId))
      .catch((e) => console.error('Async vehicle suggestion update error:', e));
  }

  return {
    bestVehicle,
    totalWeight: Math.round(totalDeliveryWeight * 100) / 100,
    totalItems: packingItems.reduce((sum, it) => sum + it.quantity, 0),
    packingItems,
    evaluatedVehicles
  };
}

