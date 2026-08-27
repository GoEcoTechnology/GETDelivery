import { config } from 'dotenv';
config();
import { sign } from 'jsonwebtoken';

async function main() {
  const { POST } = await import('./src/app/api/deliveries/[id]/dispatch/route');
  const { db } = await import('./src/db');
  const { sql } = await import('drizzle-orm');
  try {
    // 1. Get a valid order ID
    const result = await db.execute(sql`SELECT id, tenant_id FROM delivery_orders WHERE status IN ('DRAFT', 'READY_FOR_DISPATCH') LIMIT 1`);
    if (result.length === 0) {
      console.log('No valid orders found to dispatch.');
      return;
    }
    const orderId = result[0].id;
    const tenantId = result[0].tenant_id;

    // 2. Generate token
    const token = sign({
      role: 'BUSINESS_OWNER',
      tenantId: tenantId,
      userId: 1,
    }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '1h' });

    // 3. Mock request
    const req = new Request(`http://localhost:3000/api/deliveries/${orderId}/dispatch`, {
      method: 'POST',
      headers: {
        'x-user-role': 'PLATFORM_OWNER',
        'x-user-id': '1',
        'x-tenant-id': String(tenantId)
      }
    });

    console.log(`Dispatching order ${orderId} for tenant ${tenantId}...`);
    
    // 4. Call POST
    const params = Promise.resolve({ id: String(orderId) });
    const res = await POST(req, { params });
    
    console.log('Status:', res.status);
    console.log('Body:', await res.json());

  } catch (error) {
    console.error('Script error:', error);
  } finally {
    process.exit(0);
  }
}

main();
