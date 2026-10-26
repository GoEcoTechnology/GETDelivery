import { NextResponse } from 'next/server';
import { calculateDeliveryQuote } from '@/lib/deliveryCalculation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, tenantId, dropoffLat, dropoffLng, priority, customDistanceKm } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one product item is required.' }, { status: 400 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Store/Tenant ID is required.' }, { status: 400 });
    }

    const result = await calculateDeliveryQuote({
      items,
      tenantId: Number(tenantId),
      dropoffLat: dropoffLat !== undefined && dropoffLat !== null ? Number(dropoffLat) : null,
      dropoffLng: dropoffLng !== undefined && dropoffLng !== null ? Number(dropoffLng) : null,
      priority: priority || 'STANDARD',
      customDistanceKm: customDistanceKm ? Number(customDistanceKm) : null
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 422 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Error calculating delivery quote:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error calculating delivery quote' },
      { status: 500 }
    );
  }
}
