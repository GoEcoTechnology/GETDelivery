import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deviceTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  // Use a generic withAuth that doesn't enforce strict permissions, just requires a logged-in user
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    try {
      const { fcmToken, deviceName, browser, operatingSystem } = await request.json();

      if (!fcmToken) {
        return NextResponse.json({ error: 'FCM Token is required' }, { status: 400 });
      }

      const userId = claims.role === 'DELIVERY_PARTNER' ? claims.partnerId : claims.userId;
      const userRole = claims.role === 'DELIVERY_PARTNER' ? 'DELIVERY_PARTNER' : (claims.role || 'USER');

      if (!userId) {
        return NextResponse.json({ error: 'User ID missing from claims' }, { status: 401 });
      }

      // Upsert the device token using global `db` instead of `tx` to bypass RLS.
      // This prevents unique constraint errors when a new user logs into a browser 
      // that already registered an FCM token for a previous user.
      const existingToken = await db
        .select()
        .from(deviceTokens)
        .where(eq(deviceTokens.fcmToken, fcmToken))
        .limit(1);

      if (existingToken.length > 0) {
        // Update to current user and refresh last seen
        await db
          .update(deviceTokens)
          .set({ 
            userId: userId as number,
            userRole: userRole as any,
            tenantId: claims.tenantId || null,
            lastSeen: new Date(), 
            updatedAt: new Date(),
            deviceName,
            browser,
            operatingSystem
          })
          .where(eq(deviceTokens.id, existingToken[0].id));
      } else {
        // Insert new token
        await db.insert(deviceTokens).values({
          userId: userId as number,
          userRole: userRole as any,
          tenantId: claims.tenantId || null,
          fcmToken,
          deviceName,
          browser,
          operatingSystem,
        });
      }

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error saving device token:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(request: Request) {
  return withAuth(request, { requiredPermissions: [] }, async (tx, claims) => {
    try {
      const { fcmToken } = await request.json();
      
      if (!fcmToken) {
        return NextResponse.json({ error: 'FCM Token is required' }, { status: 400 });
      }

      const userId = claims.role === 'DELIVERY_PARTNER' ? claims.partnerId : claims.userId;
      const userRole = claims.role === 'DELIVERY_PARTNER' ? 'DELIVERY_PARTNER' : (claims.role || 'USER');

      if (!userId) {
        return NextResponse.json({ error: 'User ID missing from claims' }, { status: 401 });
      }

      await db
        .delete(deviceTokens)
        .where(
          and(
            eq(deviceTokens.userId, userId as number),
            eq(deviceTokens.userRole, userRole as any),
            eq(deviceTokens.fcmToken, fcmToken)
          )
        );

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error('Error deleting device token:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
