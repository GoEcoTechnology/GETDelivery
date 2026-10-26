import { NextResponse } from 'next/server';
import { platformDeliverySettings, vehicleDeliveryRates, vehicles } from '@/db/schema';
import { withAuth } from '@/lib/api-helper';
import { desc, asc, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [settingsResult, ratesResult, vehicleTypesResult] = await Promise.all([
      tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1),
      tx.select({
        vehicleType: vehicleDeliveryRates.vehicleType,
        basePrice: vehicleDeliveryRates.basePrice,
        pricePerKm: vehicleDeliveryRates.pricePerKm,
        capacityKg: vehicleDeliveryRates.capacityKg,
        cargoLengthCm: vehicleDeliveryRates.cargoLengthCm,
        cargoWidthCm: vehicleDeliveryRates.cargoWidthCm,
        cargoHeightCm: vehicleDeliveryRates.cargoHeightCm,
        isActive: vehicleDeliveryRates.isActive,
        updatedAt: vehicleDeliveryRates.updatedAt,
      })
      .from(vehicleDeliveryRates)
      .orderBy(asc(vehicleDeliveryRates.vehicleType)),
      tx.select({
        vehicleType: vehicles.vehicleType,
      })
      .from(vehicles)
      .groupBy(vehicles.vehicleType)
      .orderBy(asc(vehicles.vehicleType))
    ]);

    const settings = settingsResult[0];
    const rates = ratesResult;
    const vehicleTypes = vehicleTypesResult;

    return NextResponse.json({ data: { settings: settings || null, rates, vehicleTypes } });
  });
}

export async function PUT(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const pricePerKm = Number(body.pricePerKm);
    const rates = Array.isArray(body.rates) ? body.rates : [];

    if (!Number.isFinite(pricePerKm) || pricePerKm < 0) {
      return NextResponse.json({ error: 'Invalid price per kilometer' }, { status: 400 });
    }

    const [savedSettings] = await tx
      .insert(platformDeliverySettings)
      .values({
        pricePerKm: pricePerKm.toString(),
        urgentDeliveryFee: Number(body.urgentDeliveryFee || 0).toString(),
        currencyCode: body.currencyCode || 'PHP',
        updatedBy: claims.userId as number,
      })
      .returning();

    const ratePromises = rates.map((rate: any) => {
      if (!rate.vehicleType) return null;
      const vehiclePricePerKm = Number(rate.pricePerKm || 0);
      const capacityKg = Math.max(0, parseInt(String(rate.capacityKg || 0), 10) || 0);
      const cargoLengthCm = Math.max(0, Number(rate.cargoLengthCm || 0)).toFixed(2);
      const cargoWidthCm = Math.max(0, Number(rate.cargoWidthCm || 0)).toFixed(2);
      const cargoHeightCm = Math.max(0, Number(rate.cargoHeightCm || 0)).toFixed(2);

      return tx
        .insert(vehicleDeliveryRates)
        .values({
          vehicleType: String(rate.vehicleType),
          basePrice: '0',
          pricePerKm: vehiclePricePerKm.toString(),
          capacityKg,
          cargoLengthCm,
          cargoWidthCm,
          cargoHeightCm,
          isActive: Boolean(rate.isActive),
          updatedBy: claims.userId as number,
        })
        .onConflictDoUpdate({
          target: vehicleDeliveryRates.vehicleType,
          set: {
            basePrice: '0',
            pricePerKm: vehiclePricePerKm.toString(),
            capacityKg,
            cargoLengthCm,
            cargoWidthCm,
            cargoHeightCm,
            isActive: Boolean(rate.isActive),
            updatedBy: claims.userId as number,
            updatedAt: sql`now()`,
          },
        });
    }).filter(Boolean);

    await Promise.all(ratePromises);

    return NextResponse.json({ success: true, data: savedSettings });
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const vehicleType = searchParams.get('vehicleType');

    if (!vehicleType) {
      return NextResponse.json({ error: 'Vehicle type is required' }, { status: 400 });
    }
    
    const { eq } = await import('drizzle-orm');
    
    await tx.delete(vehicleDeliveryRates).where(eq(vehicleDeliveryRates.vehicleType, vehicleType));
    
    return NextResponse.json({ success: true });
  });
}
