import { db } from '@/db';
import { deliveryInvitations, deliveryPartners } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { hashPassword } from '@/lib/password';

export async function invitePartnerToActiveDeliveries(partnerId: number) {
  try {
    // Find the partner
    const [partner] = await db.select().from(deliveryPartners).where(eq(deliveryPartners.id, partnerId));
    if (!partner || (partner.status !== 'ACTIVE' && partner.status !== 'AVAILABLE') || !partner.email) {
      return;
    }

    // Find all distinct deliveryOrderIds that are currently dispatched
    // AND where this partner is NOT already invited.
    const pendingInvites = await db.execute(sql`
      SELECT o.id as delivery_order_id, o.tenant_id 
      FROM delivery_orders o
      WHERE o.status = 'DISPATCHED' 
        AND o.id NOT IN (
          SELECT delivery_order_id FROM delivery_invitations WHERE delivery_partner_id = ${partnerId}
        )
    `);

    if (!pendingInvites || pendingInvites.length === 0) return;

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    const invitationsToInsert = [];
    for (const row of pendingInvites as any[]) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = await hashPassword(token);

      invitationsToInsert.push({
        tenantId: Number(row.tenant_id),
        deliveryOrderId: Number(row.delivery_order_id),
        deliveryPartnerId: partnerId,
        tokenHash,
        status: 'PENDING',
        expiresAt
      });
    }

    if (invitationsToInsert.length > 0) {
      await db.insert(deliveryInvitations).values(invitationsToInsert);
    }
  } catch (error) {
    console.error('Error inviting new partner to active deliveries:', error);
  }
}
