import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
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
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.receiverId, partnerId),
          eq(notifications.receiverRole, 'DELIVERY_PARTNER'),
          eq(notifications.status, 'UNREAD')
        )
      );

    return NextResponse.json({ count: unreadNotifs.length });
  } catch (error) {
    console.error('Error fetching partner unread notifs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
