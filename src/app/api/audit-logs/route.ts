import { NextResponse } from 'next/server';
import { db } from '@/db';
import { auditLogs, users } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: ['inventory.view'] }, async (tx, claims) => { // using a basic permission as a placeholder
    const tenantIdToUse = claims.role === 'PLATFORM_OWNER' ? null : claims.tenantId;
    
    let baseQuery = tx.select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      actorName: users.name
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

    if (tenantIdToUse) {
      baseQuery = baseQuery.where(eq(auditLogs.tenantId, tenantIdToUse as number));
    }
    
    const data = await baseQuery;
    return NextResponse.json({ data });
  });
}
