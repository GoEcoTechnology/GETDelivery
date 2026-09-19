import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyToken, AppJwtPayload } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token) as AppJwtPayload;
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId'); // This is actually userId from token

    if (!customerId) {
       return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const [customer] = await db.select({ id: customers.id, savedLocations: customers.savedLocations }).from(customers).where(eq(customers.userId, parseInt(customerId, 10)));
    
    if (!customer) {
      return NextResponse.json({ data: [] });
    }

    return NextResponse.json({ data: customer.savedLocations });
  } catch (error) {
    console.error('Failed to fetch customer locations:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token) as AppJwtPayload;
    if (!payload || !payload.id) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, location } = body; // This customerId is actually userId

    if (!customerId || !location || !location.lat || !location.lng || !location.locationName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [customer] = await db.select({ id: customers.id, savedLocations: customers.savedLocations }).from(customers).where(eq(customers.userId, parseInt(customerId, 10)));
    
    if (!customer) {
      return NextResponse.json({ error: 'Customer profile not found. Please complete an order first.' }, { status: 404 });
    }

    const currentLocations = Array.isArray(customer.savedLocations) ? customer.savedLocations : [];
    
    // Replace if locationName exists, else push
    const index = currentLocations.findIndex((l: any) => l.locationName === location.locationName);
    if (index >= 0) {
       currentLocations[index] = location;
    } else {
       currentLocations.push(location);
    }

    await db.update(customers).set({ savedLocations: currentLocations }).where(eq(customers.id, customer.id));

    return NextResponse.json({ success: true, data: currentLocations });
  } catch (error) {
    console.error('Failed to save customer location:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
