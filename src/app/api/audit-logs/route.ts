import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';
import { purgeExpiredDeliveries } from '@/lib/delivery-purge';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => { // using a basic permission as a placeholder
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : (claims.tenantId as number | null | undefined);
    
    // Purge expired audit logs (> 1 month) & deliveries
    await purgeExpiredDeliveries(tenantIdToUse).catch(err => {
      console.error('Error during auto-purge in audit-logs route:', err);
    });
    
    const { searchParams } = new URL(request.url);
    const limitParam = parseInt(searchParams.get('limit') || '200', 10);
    const limit = Math.min(Math.max(1, limitParam), 2000);

    let baseQuery = tx.select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorType: auditLogs.actorType,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);

    if (tenantIdToUse) {
      baseQuery = baseQuery.where(eq(auditLogs.tenantId, tenantIdToUse as number));
    }
    
    const data = await baseQuery;
    return NextResponse.json({ data });
  });
}
