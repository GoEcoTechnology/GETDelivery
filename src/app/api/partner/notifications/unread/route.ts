import { NextResponse } from 'next/server';
import { db } from '@/db';
import { partnerNotifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';

export async function GET() {
  try {
    const headersList = await headers();
    const partnerIdStr = headersList.get('x-partner-id');
    const role = headersList.get('x-user-role');

    if (!partnerIdStr || role !== 'DELIVERY_PARTNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const partnerId = parseInt(partnerIdStr, 10);

    const unreadNotifs = await db
      .select({ id: partnerNotifications.id })
      .from(partnerNotifications)
      .where(
        and(
          eq(partnerNotifications.deliveryPartnerId, partnerId),
          eq(partnerNotifications.isRead, false)
        )
      );

    return NextResponse.json({ count: unreadNotifs.length });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
