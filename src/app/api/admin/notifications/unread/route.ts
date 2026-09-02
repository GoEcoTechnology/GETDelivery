import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);

    if (!claims || !['PLATFORM_OWNER', 'BUSINESS_OWNER', 'EMPLOYEE'].includes(claims.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;
    
    const userId = claims.userId as number;
    const userRole = claims.role as string;

    const unreadNotifs = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.status, 'UNREAD'),
          or(
            and(
              eq(notifications.receiverId, userId),
              eq(notifications.receiverRole, userRole)
            ),
            and(
              eq(notifications.receiverId, 0),
              eq(notifications.receiverRole, userRole),
              eq(notifications.tenantId, tenantIdToUse)
            )
          )
        )
      );

    return NextResponse.json({ count: unreadNotifs.length });
  } catch (error) {
    console.error('Error fetching unread notifs:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
