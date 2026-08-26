import { NextResponse } from 'next/server';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, or, desc, inArray } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function GET(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    try {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') || '20', 10);
      const offset = parseInt(url.searchParams.get('offset') || '0', 10);

      const userId = claims.role === 'DELIVERY_PARTNER' ? claims.partnerId : claims.userId;
      const userRole = claims.role === 'DELIVERY_PARTNER' ? 'DELIVERY_PARTNER' : (claims.role || 'USER');

      if (!userId) {
        return NextResponse.json({ error: 'User ID missing from claims' }, { status: 401 });
      }

      // Fetch notifications matching receiverId or (receiverId = 0 and tenantId matches)
      const data = await tx
        .select()
        .from(notifications)
        .where(
          or(
            and(
              eq(notifications.receiverId, userId as number),
              eq(notifications.receiverRole, userRole as any)
            ),
            and(
              eq(notifications.receiverId, 0),
              eq(notifications.receiverRole, userRole as any),
              eq(notifications.tenantId, claims.tenantId as number)
            )
          )
        )
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset);

      return NextResponse.json({ notifications: data });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PATCH(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    try {
      const { notificationIds, action } = await request.json();

      if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
        return NextResponse.json({ error: 'Notification IDs required' }, { status: 400 });
      }

      const userId = claims.role === 'DELIVERY_PARTNER' ? claims.partnerId : claims.userId;
      const userRole = claims.role === 'DELIVERY_PARTNER' ? 'DELIVERY_PARTNER' : (claims.role || 'USER');

      if (!userId) {
        return NextResponse.json({ error: 'User ID missing from claims' }, { status: 401 });
      }

      const updateData: any = {};
      
      if (action === 'mark_read') {
        updateData.status = 'READ';
        updateData.readAt = new Date();
      } else if (action === 'mark_clicked') {
        updateData.status = 'READ';
        updateData.readAt = new Date();
        updateData.clickedAt = new Date();
      } else {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }

      await tx
        .update(notifications)
        .set(updateData)
        .where(
          and(
            inArray(notifications.id, notificationIds),
            or(
              and(
                eq(notifications.receiverId, userId as number),
                eq(notifications.receiverRole, userRole as any)
              ),
              and(
                eq(notifications.receiverId, 0),
                eq(notifications.receiverRole, userRole as any),
                eq(notifications.tenantId, claims.tenantId as number)
              )
            )
          )
        );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
