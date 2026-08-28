import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deviceTokens } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth } from '@/lib/api-helper';

export async function POST(request: Request) {
  return withAuth(request, {}, async (tx, claims) => {
    try {
      const { fcmToken } = await request.json();

      if (!fcmToken) {
        return NextResponse.json({ error: 'Missing fcmToken' }, { status: 400 });
      }

      // Delete the specific token from the database using superuser to bypass RLS safely
      await db.delete(deviceTokens).where(
        and(
          eq(deviceTokens.fcmToken, fcmToken),
          eq(deviceTokens.userId, claims.userId || claims.partnerId || 0)
        )
      );

      return NextResponse.json({ success: true, message: 'Token removed successfully' });
    } catch (error) {
      console.error('Failed to remove FCM token on logout:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
