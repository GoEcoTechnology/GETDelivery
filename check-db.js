import 'dotenv/config';
import { db } from './src/db/index.js';
import { drivers, vehicles } from './src/db/schema.js';

async function main() {
  const allDrivers = await db.select().from(drivers);
  console.log('Drivers:', allDrivers);

  const allVehicles = await db.select().from(vehicles);
  console.log('Vehicles:', allVehicles);
  
  process.exit(0);
}

main().catch(console.error);
