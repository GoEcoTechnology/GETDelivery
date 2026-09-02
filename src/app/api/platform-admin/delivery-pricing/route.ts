import { NextResponse } from 'next/server';
import { platformDeliverySettings, vehicleDeliveryRates, vehicles } from '@/db/schema';
import { withAuth } from '@/lib/api-helper';
import { desc, asc, sql } from 'drizzle-orm';

export async function GET(request: Request) {
  return withAuth(request, async (tx, claims) => {
    if (claims.role !== 'PLATFORM_OWNER') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const [settings] = await tx.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);
    const rates = await tx
      .select({
        vehicleType: vehicleDeliveryRates.vehicleType,
        basePrice: vehicleDeliveryRates.basePrice,
        isActive: vehicleDeliveryRates.isActive,
        updatedAt: vehicleDeliveryRates.updatedAt,
      })
      .from(vehicleDeliveryRates)
      .orderBy(asc(vehicleDeliveryRates.vehicleType));

    const vehicleTypes = await tx
      .select({
        vehicleType: vehicles.vehicleType,
      })
      .from(vehicles)
      .groupBy(vehicles.vehicleType)
      .orderBy(asc(vehicles.vehicleType));

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
        currencyCode: body.currencyCode || 'PHP',
        updatedBy: claims.userId as number,
      })
      .returning();

    for (const rate of rates) {
      if (!rate.vehicleType) continue;
      const basePrice = Number(rate.basePrice || 0);
      await tx
        .insert(vehicleDeliveryRates)
        .values({
          vehicleType: String(rate.vehicleType),
          basePrice: basePrice.toString(),
          isActive: Boolean(rate.isActive),
          updatedBy: claims.userId as number,
        })
        .onConflictDoUpdate({
          target: vehicleDeliveryRates.vehicleType,
          set: {
            basePrice: basePrice.toString(),
            isActive: Boolean(rate.isActive),
            updatedBy: claims.userId as number,
            updatedAt: sql`now()`,
          },
        });
    }

    return NextResponse.json({ success: true, data: savedSettings });
  });
}
