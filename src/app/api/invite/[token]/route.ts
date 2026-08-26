import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitResult = await rateLimit(`invite:${ip}`, 10, 60000); 
    
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: 'Too many attempts. Please try again later.' }, { status: 429 });
    }

    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const [inviteIdStr, plainToken] = token.split('_');
    const inviteId = parseInt(inviteIdStr, 10);

    if (isNaN(inviteId) || !plainToken) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }
    
    const [invitation] = await db.select().from(deliveryInvitations).where(eq(deliveryInvitations.id, inviteId));

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invitation.status !== 'PENDING' || new Date() > new Date(invitation.expiresAt)) {
      return NextResponse.json({ error: 'Invitation has expired or is no longer valid' }, { status: 400 });
    }

    // Cryptographically verify the token
    const isValidToken = await verifyPassword(plainToken, invitation.tokenHash);
    if (!isValidToken) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    // Update status to OPENED if it was PENDING
    if (invitation.status === 'PENDING') {
      await db
        .update(deliveryInvitations)
        .set({ status: 'OPENED', openedAt: new Date() })
        .where(eq(deliveryInvitations.id, invitation.id));
    }

    // Fetch related delivery info safely, avoiding SELECT *
    const [delivery] = await db
      .select({
        id: deliveryOrders.id,
        pickupAddress: deliveryOrders.pickupAddress,
        deliveryAddress: deliveryOrders.dropoffAddress, // schema has dropoffAddress, not deliveryAddress!
        status: deliveryOrders.status
      })
      .from(deliveryOrders)
      .where(eq(deliveryOrders.id, invitation.deliveryOrderId));
    
    if (!delivery || delivery.status !== 'DISPATCHED') {
      // Changed to DISPATCHED since a PENDING delivery is not dispatched yet.
      return NextResponse.json({ error: 'Delivery is no longer available' }, { status: 400 });
    }

    return NextResponse.json({
      data: {
        deliveryId: delivery.id,
        pickupAddress: delivery.pickupAddress,
        deliveryAddress: delivery.deliveryAddress,
        expiresAt: invitation.expiresAt
      }
    });
  } catch (error) {
    console.error('Invite token error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
