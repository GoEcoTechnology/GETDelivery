import 'dotenv/config';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import argon2 from '@node-rs/argon2';
import { eq } from 'drizzle-orm';

async function run() {
  console.log('Deleting existing B2B customers...');
  await db.delete(schema.customers);
  await db.delete(schema.users).where(eq(schema.users.role, 'CUSTOMER'));

  // Create 3 marketplace customers
  const defaultPassword = '123123';
  const passwordHash = await argon2.hash(defaultPassword);

  const newCustomers = [
    { email: 'customer1@gmail.com', name: 'Jose Rizal' },
    { email: 'customer2@gmail.com', name: 'Andres Bonifacio' },
    { email: 'customer3@gmail.com', name: 'Emilio Aguinaldo' }
  ];

  let i = 1;
  for (const c of newCustomers) {
    await db.insert(schema.users).values({
      tenantId: null, // Null tenant means they don't belong to any business owner (Marketplace Customer)
      name: c.name,
      firstName: c.name.split(' ')[0],
      lastName: c.name.split(' ')[1],
      email: c.email,
      contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
      passwordHash,
      role: 'CUSTOMER',
      status: 'ACTIVE'
    });
    i++;
  }
  
  console.log('Successfully recreated 3 marketplace customers.');
  process.exit(0);
}
run();
