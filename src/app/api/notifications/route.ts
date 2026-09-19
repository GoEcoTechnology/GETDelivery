import { NextResponse } from 'next/server';
import { db } from '@/db';
import { sql } from 'drizzle-orm';
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

      const rows = await tx.execute(sql`
        SELECT
          id,
          tenant_id AS "tenantId",
          delivery_order_id AS "deliveryOrderId",
          sender_id AS "senderId",
          receiver_id AS "receiverId",
          receiver_role AS "receiverRole",
          recipient_email AS "recipientEmail",
          notification_type AS "notificationType",
          title,
          body,
          image,
          action_url AS "actionUrl",
          status,
          error_message AS "errorMessage",
          created_at AS "createdAt",
          read_at AS "readAt",
          clicked_at AS "clickedAt"
        FROM notifications
        WHERE ((receiver_id = ${userId} AND receiver_role = ${userRole}) OR (receiver_id = 0 AND receiver_role = ${userRole} AND tenant_id = ${claims.tenantId}))
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `);

      return NextResponse.json({ notifications: Array.isArray(rows.rows) ? rows.rows : [] });
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

      const setSegments = action === 'mark_read'
        ? sql`status = 'READ', read_at = NOW()`
        : action === 'mark_clicked'
          ? sql`status = 'READ', read_at = NOW(), clicked_at = NOW()`
          : null;

      if (!setSegments) {
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
      }

      await tx.execute(sql`
        UPDATE notifications
        SET ${setSegments}
        WHERE id = ANY(${notificationIds})
          AND ((receiver_id = ${userId} AND receiver_role = ${userRole}) OR (receiver_id = 0 AND receiver_role = ${userRole} AND tenant_id = ${claims.tenantId}))
      `);

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error updating notifications:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
