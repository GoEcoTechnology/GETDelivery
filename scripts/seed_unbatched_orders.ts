import 'dotenv/config';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function seedOrders() {
  console.log('--- Seeding Unbatched Orders ---');
  
  const customers = await db.select().from(schema.customers);
  if (customers.length === 0) {
    console.error('No customers found. Cannot seed orders.');
    process.exit(1);
  }

  const products = await db.select().from(schema.products);
  const variants = await db.select().from(schema.productVariants);
  if (products.length === 0 || variants.length === 0) {
    console.error('No products or variants found. Cannot seed orders.');
    process.exit(1);
  }

  const tenants = await db.select().from(schema.tenants);
  const defaultTenant = tenants[0];

  for (let i = 0; i < 15; i++) {
    const cust = customers[Math.floor(Math.random() * customers.length)];
    const date = new Date();
    
    const [order] = await db.insert(schema.deliveryOrders).values({
      tenantId: cust.tenantId || defaultTenant.id,
      customerId: cust.id,
      customerName: cust.name,
      customerContact: cust.mobileNumber,
      pickupAddress: 'Main Warehouse',
      dropoffAddress: cust.address,
      deliveryDate: date,
      status: 'WAITING',
      orderSource: 'MARKETPLACE',
      deliveryPriority: Math.random() > 0.8 ? 'URGENT' : 'NORMAL'
    }).returning();

    const numItems = Math.floor(Math.random() * 3) + 1;
    let totalOrderValue = 0;
    
    for (let j = 0; j < numItems; j++) {
      const variant = variants[Math.floor(Math.random() * variants.length)];
      const prod = products.find(p => p.id === variant.productId);
      
      const qty = Math.floor(Math.random() * 4) + 1;
      const price = Number(variant.price || 0);
      totalOrderValue += qty * price;
      
      await db.insert(schema.deliveryItems).values({
        deliveryOrderId: order.id,
        productId: variant.productId,
        variantId: variant.id,
        productName: prod ? prod.name : 'Unknown Product',
        quantity: qty,
        unitPrice: price.toString(),
        unit: variant.unit || 'pcs'
      });
    }
    
    // Update the order with realistic amounts
    await db.update(schema.deliveryOrders)
      .set({
        finalDeliveryPrice: totalOrderValue.toString(),
        offeredAmount: (totalOrderValue * 0.1).toFixed(2), // 10% delivery fee
      })
      .where(eq(schema.deliveryOrders.id, order.id));
  }

  console.log('--- Successfully seeded 15 new unbatched orders! ---');
  process.exit(0);
}

seedOrders().catch(console.error);
