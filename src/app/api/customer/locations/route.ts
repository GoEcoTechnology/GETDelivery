import { NextResponse } from 'next/server';
import { db } from '@/db';
import { customers, deliveryOrders, tenants, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

async function getAuthUserId(request: Request): Promise<number | null> {
  // 1. Check header injected by middleware
  const headerUserId = request.headers.get('x-user-id');
  if (headerUserId && !isNaN(parseInt(headerUserId, 10))) {
    return parseInt(headerUserId, 10);
  }

  // 2. Check Authorization header
  let token: string | null = null;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]?.trim();
  }

  // 3. Fallback to token cookie
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) {
      token = decodeURIComponent(match[1]);
    }
  }

  if (!token) return null;

  try {
    const payload = await verifyToken(token);
    if (!payload) return null;
    const uid = (payload as any).userId ?? (payload as any).id;
    return uid ? parseInt(String(uid), 10) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const authUserId = await getAuthUserId(request);
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const targetUserId = customerId ? parseInt(customerId, 10) : authUserId;

    const [customer] = await db
      .select({ id: customers.id, address: customers.address, savedLocations: customers.savedLocations })
      .from(customers)
      .where(eq(customers.userId, targetUserId));
    
    if (!customer) {
      return NextResponse.json({ data: [], defaultLocation: null, hasSetLocation: false });
    }

    const rawLocations = Array.isArray(customer.savedLocations) ? customer.savedLocations : [];
    // Filter only valid locations that the customer has explicitly saved
    const currentLocations = rawLocations.filter((l: any) => l && l.lat && l.lng);

    // Find default location: preferred isDefault === true, or first valid entry
    const defaultLocation = currentLocations.find((l: any) => l.isDefault && l.lat && l.lng) ||
      currentLocations.find((l: any) => l.lat && l.lng) ||
      null;

    return NextResponse.json({
      data: currentLocations,
      defaultLocation,
      hasSetLocation: Boolean(defaultLocation && defaultLocation.lat && defaultLocation.lng)
    });
  } catch (error) {
    console.error('Failed to fetch customer locations:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUserId = await getAuthUserId(request);
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, location, action, locationId } = body;
    const targetUserId = customerId ? parseInt(String(customerId), 10) : authUserId;

    let [customer] = await db
      .select({ id: customers.id, address: customers.address, savedLocations: customers.savedLocations })
      .from(customers)
      .where(eq(customers.userId, targetUserId));
    
    // Lazy create customer record if doesn't exist yet
    if (!customer) {
      let customerTenantId = 1;
      const [anyTenant] = await db.select({ id: tenants.id }).from(tenants).limit(1);
      if (anyTenant) customerTenantId = anyTenant.id;

      const [user] = await db.select().from(users).where(eq(users.id, targetUserId));
      const [newCustomer] = await db.insert(customers).values({
        userId: targetUserId,
        tenantId: customerTenantId,
        name: user?.name || 'Customer',
        mobileNumber: user?.contactNumber || 'N/A',
        address: location?.address || 'N/A',
        status: 'ACTIVE',
        savedLocations: []
      }).returning({ id: customers.id, address: customers.address, savedLocations: customers.savedLocations });
      customer = newCustomer;
    }

    // Action: Set existing location as default
    if (action === 'SET_DEFAULT' && locationId) {
      const currentLocations = Array.isArray(customer.savedLocations) ? [...customer.savedLocations] : [];
      let targetLoc: any = null;
      const updatedLocs = currentLocations.map((l: any) => {
        if (l.id === locationId || l.locationName === locationId) {
          targetLoc = { ...l, isDefault: true };
          return targetLoc;
        }
        return { ...l, isDefault: false };
      });

      await db.update(customers).set({
        savedLocations: updatedLocs,
        address: targetLoc?.address || customer.address
      }).where(eq(customers.id, customer.id));

      return NextResponse.json({
        success: true,
        data: updatedLocs,
        defaultLocation: targetLoc,
        hasSetLocation: Boolean(targetLoc && targetLoc.lat && targetLoc.lng)
      });
    }

    if (!location || !location.lat || !location.lng) {
      return NextResponse.json({ error: 'Missing required location coordinates' }, { status: 400 });
    }

    const currentLocations = Array.isArray(customer.savedLocations) ? [...customer.savedLocations] : [];
    
    // Mark others as not default if new location is default
    const isDefault = location.isDefault !== false;
    const updatedLocs = currentLocations.map((l: any) => ({
      ...l,
      isDefault: isDefault ? false : l.isDefault
    }));

    const locName = (location.locationName && location.locationName.trim()) ||
      (location.landmark && location.landmark.trim()) ||
      (location.address ? location.address.split(',')[0].trim() : 'Delivery Address');

    const locToSave = {
      id: location.id || Date.now().toString(),
      locationName: locName,
      address: location.address || '',
      lat: Number(location.lat),
      lng: Number(location.lng),
      landmark: location.landmark ? location.landmark.trim() : '',
      isDefault,
      updatedAt: new Date().toISOString()
    };

    const index = updatedLocs.findIndex((l: any) => (l.id && l.id === locToSave.id) || l.locationName === locToSave.locationName);
    if (index >= 0) {
      updatedLocs[index] = { ...updatedLocs[index], ...locToSave };
    } else {
      updatedLocs.unshift(locToSave);
    }

    await db.update(customers).set({
      savedLocations: updatedLocs,
      address: isDefault ? (locToSave.address || customer.address) : customer.address
    }).where(eq(customers.id, customer.id));

    return NextResponse.json({
      success: true,
      data: updatedLocs,
      defaultLocation: isDefault ? locToSave : (updatedLocs.find((l: any) => l.isDefault) || locToSave),
      hasSetLocation: true
    });
  } catch (error) {
    console.error('Failed to save customer location:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authUserId = await getAuthUserId(request);
    if (!authUserId) {
      return NextResponse.json({ error: 'Unauthorized or invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');
    const locationId = searchParams.get('locationId');
    const targetUserId = customerId ? parseInt(customerId, 10) : authUserId;

    if (!locationId) {
      return NextResponse.json({ error: 'Missing locationId' }, { status: 400 });
    }

    const [customer] = await db
      .select({ id: customers.id, address: customers.address, savedLocations: customers.savedLocations })
      .from(customers)
      .where(eq(customers.userId, targetUserId));

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const currentLocations = Array.isArray(customer.savedLocations) ? customer.savedLocations : [];
    const filteredLocations = currentLocations.filter((l: any) => l.id !== locationId && l.locationName !== locationId);

    const wasDefault = currentLocations.find((l: any) => (l.id === locationId || l.locationName === locationId) && l.isDefault);
    if (wasDefault && filteredLocations.length > 0) {
      filteredLocations[0] = { ...filteredLocations[0], isDefault: true };
    }

    const newDefaultLoc = filteredLocations.find((l: any) => l.isDefault) || filteredLocations[0] || null;

    await db.update(customers).set({
      savedLocations: filteredLocations,
      address: newDefaultLoc?.address || customer.address
    }).where(eq(customers.id, customer.id));

    return NextResponse.json({
      success: true,
      data: filteredLocations,
      defaultLocation: newDefaultLoc,
      hasSetLocation: Boolean(newDefaultLoc && newDefaultLoc.lat && newDefaultLoc.lng)
    });
  } catch (error) {
    console.error('Failed to delete customer location:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
