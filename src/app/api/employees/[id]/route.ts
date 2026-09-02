import { NextResponse } from 'next/server';
import { users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

// DELETE - remove an employee (BUSINESS_OWNER only, must belong to same tenant)
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    if (claims.role !== 'BUSINESS_OWNER') {
      return NextResponse.json({ error: 'Only business owners can remove employees' }, { status: 403 });
    }

    const { id } = await params;
    const employeeId = parseInt(id, 10);

    const [employee] = await tx
      .select()
      .from(users)
      .where(and(eq(users.id, employeeId), eq(users.tenantId, claims.tenantId as number), eq(users.role, 'EMPLOYEE')));

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    await tx.delete(users).where(eq(users.id, employeeId));

    return NextResponse.json({ success: true });
  });
}
