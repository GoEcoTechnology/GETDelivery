import 'dotenv/config';
import { db } from './src/db';
import { deliveryPartners } from './src/db/schema';
import { hashPassword } from './src/lib/password';

async function main() {
  const passwordHash = await hashPassword('partner123');
  
  await db.insert(deliveryPartners).values({
    companyName: 'Speedy Delivery PH',
    contactPerson: 'Juan Dela Cruz',
    mobileNumber: '+639123456789',
    email: 'juan@speedy.ph',
    passwordHash,
    status: 'ACTIVE'
  });
  
  console.log('Partner created! Mobile: +639123456789, Password: partner123');
  process.exit(0);
}

main().catch(console.error);
