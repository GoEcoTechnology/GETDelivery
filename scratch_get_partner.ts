import { db } from './src/db';
import { deliveryPartners } from './src/db/schema';

async function main() {
  const partners = await db.select().from(deliveryPartners).limit(5);
  console.log("Partners:", partners.map(p => ({
    id: p.id,
    mobile: p.mobileNumber,
    hasPassword: !!p.passwordHash
  })));
  process.exit(0);
}

main().catch(console.error);
