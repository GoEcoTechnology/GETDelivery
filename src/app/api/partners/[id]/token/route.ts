import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryPartners } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, { requiredPermissions: ['platform.manage_partners'] }, async (tx, claims) => {
    try {
      const partnerId = parseInt((await params).id, 10);
      const { notificationToken } = await request.json();

      if (isNaN(partnerId)) {
        return NextResponse.json({ error: 'Invalid partner ID' }, { status: 400 });
      }

      if (!notificationToken) {
        return NextResponse.json({ error: 'Notification token is required' }, { status: 400 });
      }

      const tenantIdToUse = (claims.role === 'PLATFORM_OWNER' && request.headers.get('x-tenant-id')
        ? parseInt(request.headers.get('x-tenant-id') || '0', 10)
        : claims.tenantId) as number | null;

      // Ensure the partner exists (Note: partner table currently doesn't have tenantId in schema, but we should verify they exist)
      const [partner] = await tx
        .select()
        .from(deliveryPartners)
        .where(eq(deliveryPartners.id, partnerId));

      if (!partner) {
        return NextResponse.json({ error: 'Partner not found' }, { status: 404 });
      }

      // Update the token
      await tx
        .update(deliveryPartners)
        .set({ notificationToken })
        .where(eq(deliveryPartners.id, partnerId));

      return NextResponse.json({ success: true, message: 'Token updated successfully' });
    } catch (error) {
      console.error('Error updating partner token:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
