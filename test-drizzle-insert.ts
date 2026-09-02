import { db } from './src/db/index.js';
import { deliveryOrders } from './src/db/schema.js';

async function test() {
  try {
    const hugeString = '[' + new Array(10000).fill('[12.97867,124.013027]').join(',') + ']';
    
    await db.insert(deliveryOrders).values({
      tenantId: 1,
      customerId: 1,
      customerName: 'Alpha',
      customerContact: '0917',
      pickupAddress: 'A',
      dropoffAddress: 'B',
      pickupLat: '12.9786499',
      pickupLng: '124.0136316',
      dropoffLat: '18.166667',
      dropoffLng: '120.75',
      routeDistance: '1km',
      routeDuration: '1m',
      routePolyline: hugeString,
      deliveryDate: new Date('2026-09-03T05:46:00.000Z'),
      instructions: 'Fragile',
      preferredVehicle: 'Motorcycle',
      status: 'DRAFT',
      currentOrdersCount: 32
    }).returning();
    console.log('Success!');
  } catch (e) {
    console.error('Error properties:', JSON.stringify(e, Object.getOwnPropertyNames(e), 2));
  }
  process.exit(0);
}
test();
