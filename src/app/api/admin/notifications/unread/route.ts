import { NextResponse } from 'next/server';
import { db } from '@/db';
import { tenantNotifications } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { headers } from 'next/headers';
import { verifyToken } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const claims = await verifyToken(token);

    if (!claims || (claims.role !== 'PLATFORM_OWNER' && claims.role !== 'TENANT_ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
      ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
      : claims.tenantId) as number;

    const unreadNotifs = await db
      .select({ id: tenantNotifications.id })
      .from(tenantNotifications)
      .where(
        and(
          eq(tenantNotifications.tenantId, tenantIdToUse),
          eq(tenantNotifications.isRead, false)
        )
      );

    return NextResponse.json({ count: unreadNotifs.length });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
