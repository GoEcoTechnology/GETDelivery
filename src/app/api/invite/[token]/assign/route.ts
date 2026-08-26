import { NextResponse } from 'next/server';
import { db } from '@/db';
import { deliveryInvitations, deliveryOrders, deliveryAssignments, drivers, vehicles } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { signToken, DriverJwtPayload } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const rateLimitResult = await rateLimit(`assign:${ip}`, 5, 60000); 
    
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

    const { driverName, vehicleDetails } = await request.json();

    if (!driverName || !vehicleDetails) {
      return NextResponse.json({ error: 'Driver name and Vehicle details must be provided' }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // 1. Fetch and validate invitation
      const [invitation] = await tx
        .select()
        .from(deliveryInvitations)
        .where(eq(deliveryInvitations.id, inviteId));

      if (!invitation) throw new Error('Invalid invitation link');
      
      if (invitation.status !== 'OPENED' && invitation.status !== 'PENDING') {
        throw new Error('Invitation is no longer valid');
      }

      if (new Date() > new Date(invitation.expiresAt)) {
        throw new Error('Invitation has expired');
      }

      const isValidToken = await verifyPassword(plainToken, invitation.tokenHash);
      if (!isValidToken) throw new Error('Invalid token');

      // 2. Fetch and validate order
      const [order] = await tx
        .select()
        .from(deliveryOrders)
        .where(eq(deliveryOrders.id, invitation.deliveryOrderId));

      if (order.status !== 'DISPATCHED') {
        throw new Error('Delivery has already been assigned or is not available');
      }

      // 3. Race Condition Protection: Update order status atomically
      const updatedOrders = await tx
        .update(deliveryOrders)
        .set({ status: 'ASSIGNED' })
        .where(and(eq(deliveryOrders.id, order.id), eq(deliveryOrders.status, 'DISPATCHED')))
        .returning();

      if (updatedOrders.length === 0) {
        throw new Error('Delivery was assigned to another partner');
      }

      // 4. Update the successful invitation
      await tx
        .update(deliveryInvitations)
        .set({ status: 'ASSIGNED', respondedAt: new Date() })
        .where(eq(deliveryInvitations.id, invitation.id));

      // 5. Expire all other invitations for this order
      await tx
        .update(deliveryInvitations)
        .set({ status: 'EXPIRED' })
        .where(and(
          eq(deliveryInvitations.deliveryOrderId, order.id),
          ne(deliveryInvitations.id, invitation.id)
        ));

      // Validate inputs are non-empty strings (already checked above, but just to be sure)
      if (typeof driverName !== 'string' || typeof vehicleDetails !== 'string') {
        throw new Error('Invalid driver or vehicle details');
      }

      // 6. Create Driver Assignment
      const [assignment] = await tx.insert(deliveryAssignments).values({
        tenantId: invitation.tenantId,
        deliveryOrderId: order.id,
        deliveryPartnerId: invitation.deliveryPartnerId,
        driverName: driverName,
        vehicleDetails: vehicleDetails,
        status: 'ASSIGNED'
      }).returning();

      return assignment;
    });

    // Generate secure Driver JWT Access token
    const driverPayload: DriverJwtPayload = {
      assignmentId: result.id,
      deliveryOrderId: result.deliveryOrderId,
      type: 'DRIVER_ACCESS',
    };
    
    const driverToken = await signToken(driverPayload, '3d');
    const driverAccessLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/driver/${driverToken}`;

    return NextResponse.json({ 
      success: true, 
      assignment: result,
      driverAccessLink
    });

  } catch (error: any) {
    console.error('Assignment error:', error);
    if (error.message.includes('assigned to another') || error.message.includes('Invalid') || error.message.includes('no longer valid') || error.message.includes('expired')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
