import { NextResponse } from 'next/server';
import { db } from '@/db';
import { vehicleDeliveryRates } from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

/**
 * GET /api/vehicle-rates
 * Returns all active vehicle delivery rates configured by the Platform Owner.
 * Used to populate the "Vehicle Required" dropdown in delivery creation/editing.
 * Does not require tenant-specific auth — just a valid JWT.
 */
export async function GET() {
  try {
    const rates = await db
      .select({
        vehicleType: vehicleDeliveryRates.vehicleType,
        basePrice: vehicleDeliveryRates.basePrice,
        pricePerKm: vehicleDeliveryRates.pricePerKm,
        isActive: vehicleDeliveryRates.isActive,
      })
      .from(vehicleDeliveryRates)
      .where(eq(vehicleDeliveryRates.isActive, true))
      .orderBy(asc(vehicleDeliveryRates.vehicleType));

    const { platformDeliverySettings } = await import('@/db/schema');
    const { desc } = await import('drizzle-orm');
    const [settings] = await db.select().from(platformDeliverySettings).orderBy(desc(platformDeliverySettings.updatedAt)).limit(1);

    return NextResponse.json({ data: rates, platformSettings: settings || { urgentDeliveryFee: '0' } });
  } catch (error) {
    console.error('Error fetching vehicle rates:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicle rates' }, { status: 500 });
  }
}
