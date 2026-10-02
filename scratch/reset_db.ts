import { db } from '../src/db';
import {
  cartItems,
  deliveryBatchItems,
  deliveryItems,
  deliveryAssignments,
  deliveryInvitations,
  quotaAccumulations,
  productQuotas,
  deliveryOrders,
  deliveryBatches,
  stockIns,
  stockOuts,
  inventoryTransactions,
  productSellingUnits,
  productVariants,
  products
} from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function resetDb() {
  console.log('Resetting database...');

  // Use raw SQL to TRUNCATE all relevant tables to bypass foreign key constraint errors during deletion
  await db.execute(sql`
    TRUNCATE TABLE 
      cart_items, 
      delivery_batch_items, 
      delivery_items, 
      delivery_assignments, 
      delivery_invitations, 
      quota_accumulations, 
      product_quotas, 
      delivery_orders, 
      delivery_batches, 
      inventory_transactions, 
      product_selling_units, 
      product_variants, 
      products
    CASCADE;
  `);

  console.log('Data cleared (users and customers retained due to CASCADE limits or explicit exclusion).');
  
  // Find a tenant to use
  const [tenant] = await db.select().from(require('../src/db/schema').tenants).limit(1);
  if (!tenant) {
    console.error('No tenant found in database.');
    process.exit(1);
  }
  const tenantId = tenant.id;

  const [product] = await db.insert(products).values({
    tenantId,
    name: 'Simple Box',
    category: 'Packaging',
    description: 'A simple cardboard box.',
    lowStockThreshold: 10,
    status: 'ACTIVE',
    isMarketplace: true,
  }).returning();

  const [variant] = await db.insert(productVariants).values({
    tenantId,
    productId: product.id,
    name: 'Standard Size',
    quantity: 1,
    unit: 'Piece',
    price: '50.00',
    stock: 1000,
    lowStockThreshold: 10,
    productType: 'Standard',
    quota: 10,
    weightPerPieceKg: '0.5',
    status: 'ACTIVE'
  }).returning();

  console.log('Created Simple Product:', product.name);
  process.exit(0);
}

resetDb().catch(console.error);
