import { NextResponse } from 'next/server';
import { withRLS, db } from '@/db';
import type { AppJwtPayload } from '@/lib/auth';
import { hasPermission, Permission } from '@/lib/permissions';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function withAuth(
  request: Request,
  optionsOrCallback: ((tx: any, claims: AppJwtPayload) => Promise<NextResponse>) | { requiredPermissions?: Permission[] },
  callback?: (tx: any, claims: AppJwtPayload) => Promise<NextResponse>
) {
  const isOptions = typeof optionsOrCallback !== 'function';
  const actualCallback = isOptions ? callback! : (optionsOrCallback as (tx: any, claims: AppJwtPayload) => Promise<NextResponse>);
  const requiredPermissions = isOptions ? (optionsOrCallback as any).requiredPermissions || [] : [];

  const tenantIdStr = request.headers.get('x-tenant-id');
  const userIdStr = request.headers.get('x-user-id');
  const role = request.headers.get('x-user-role');
  const accessType = request.headers.get('x-access-type');

  let claims: any = {};
  if (role) {
    const partnerIdStr = request.headers.get('x-partner-id');
    let tenantId = tenantIdStr ? parseInt(tenantIdStr, 10) : null;
    const userId = userIdStr ? parseInt(userIdStr, 10) : null;

    if (!tenantId && userId && role !== 'PLATFORM_OWNER' && role !== 'DELIVERY_PARTNER') {
      const [userRow] = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.id, userId));
      tenantId = userRow?.tenantId ?? null;
    }

    claims = {
      role,
      userId,
      tenantId,
      partnerId: partnerIdStr ? parseInt(partnerIdStr, 10) : null
    };

    // Granular permission check
    for (const perm of requiredPermissions) {
      if (!hasPermission(role, perm)) {
        return NextResponse.json({ error: `Forbidden: Missing permission ${perm}` }, { status: 403 });
      }
    }
  } else if (accessType === 'PARTNER_INVITE') {
    claims = { type: 'PARTNER_INVITE', partnerId: parseInt(request.headers.get('x-partner-id') || '0', 10) };
  } else if (accessType === 'DRIVER_ACCESS') {
    claims = { type: 'DRIVER_ACCESS', assignmentId: parseInt(request.headers.get('x-assignment-id') || '0', 10) };
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    return await withRLS(claims as AppJwtPayload, async (tx) => {
      return await actualCallback(tx, claims);
    });
  } catch (error: any) {
    console.error('API Error:', error);
    // Safe production error responses
    if (error.message && (error.message.includes('not found') || error.message.includes('Insufficient') || error.message.includes('Invalid'))) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    try {
      require('fs').appendFileSync('api-error.log', new Date().toISOString() + '\n' + JSON.stringify({ message: error.message, cause: error.cause ? error.cause.message : null, code: error.code || (error.cause && error.cause.code) }, null, 2) + '\n\n');
    } catch (e) {
      console.error('Failed to write to api-error.log', e);
    }
    return NextResponse.json({ error: `Server Error: ${error.message}` }, { status: 500 });
  }
}
