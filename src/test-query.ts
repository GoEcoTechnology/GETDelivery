import { db } from './db';
import { deliveryPartners } from './db/schema';
import { eq, or } from 'drizzle-orm';

async function test() {
  const allPartners = await db.select().from(deliveryPartners);
  console.log("All partners in DB:", allPartners);

  const eligiblePartners = await db
      .select({ id: deliveryPartners.id, mobileNumber: deliveryPartners.mobileNumber, status: deliveryPartners.status })
      .from(deliveryPartners)
      .where(or(eq(deliveryPartners.status, 'ACTIVE'), eq(deliveryPartners.status, 'AVAILABLE')));
  
  console.log("Eligible partners:", eligiblePartners);
  process.exit(0);
}

test().catch(console.error);
