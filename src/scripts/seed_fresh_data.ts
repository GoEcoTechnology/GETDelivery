import 'dotenv/config';
import { db } from '../db';
import * as schema from '../db/schema';
import argon2 from '@node-rs/argon2';
import { eq, not } from 'drizzle-orm';

async function seed() {
  console.log('--- Starting Database Reset (Preserving Super Admin) ---');
  
  async function safeDelete(table: any, whereClause?: any) {
    try {
      if (whereClause) {
        await db.delete(table).where(whereClause);
      } else {
        await db.delete(table);
      }
    } catch (e: any) {
      if (e.code === '42P01' || (e.cause && e.cause.code === '42P01')) {
        console.log(`Skipping table... (does not exist)`);
      } else {
        throw e;
      }
    }
  }

  // 1. Delete all transactional data
  console.log('Deleting dependent records...');
  await safeDelete(schema.quotaAccumulations);
  await safeDelete(schema.notifications);
  await safeDelete(schema.auditLogs);
  await safeDelete(schema.deliveryAssignments);
  await safeDelete(schema.deliveryInvitations);
  await safeDelete(schema.deliveryBatchItems);
  await safeDelete(schema.deliveryBatches);
  await safeDelete(schema.deliveryItems);
  await safeDelete(schema.stockIns);
  await safeDelete(schema.stockOuts);
  await safeDelete(schema.inventoryTransactions);
  await safeDelete(schema.deliveryOrders);
  
  console.log('Deleting core tenant data...');
  await safeDelete(schema.vehicles);
  await safeDelete(schema.drivers);
  await safeDelete(schema.customers);
  await safeDelete(schema.productSellingUnits);
  await safeDelete(schema.productVariants);
  await safeDelete(schema.products);

  console.log('Deleting external roles...');
  await safeDelete(schema.deliveryPartners);

  console.log('Deleting users (Except Super Admin)...');
  // Delete users who are NOT PLATFORM_OWNER
  await safeDelete(schema.users, not(eq(schema.users.role, 'PLATFORM_OWNER')));
  
  console.log('Deleting tenants...');
  await safeDelete(schema.tenants);

  console.log('--- Reset Complete! Beginning Data Seed ---');

  const defaultPassword = '123123';
  const passwordHash = await argon2.hash(defaultPassword);

  // 1. Create Delivery Partners
  console.log('Seeding Delivery Partners...');
  const partnersData = [
    { email: 'jelodump01@gmail.com', name: 'Jelo Express', contact: '09171234561' },
    { email: 'anjelozp@gmail.com', name: 'Anjelo Logistics', contact: '09171234562' },
    { email: 'cochico.anjelop@gmail.com', name: 'Cochico Deliveries', contact: '09171234563' }
  ];
  const partnerIds: number[] = [];
  for (const p of partnersData) {
    const [inserted] = await db.insert(schema.deliveryPartners).values({
      companyName: p.name,
      contactPerson: p.name,
      mobileNumber: p.contact,
      email: p.email,
      passwordHash: passwordHash,
      status: 'ACTIVE'
    }).returning({ id: schema.deliveryPartners.id });
    partnerIds.push(inserted.id);
  }

  // 2. Create Business Owners & Tenants
  console.log('Seeding Business Owners...');
  const boData = [
    { email: 'anjeloqp@gmail.com', name: 'Anjelo Enterprise' },
    { email: 'espanojohnpaul28@gmail.com', name: 'JP Espano Trading' }
  ];
  
  const tenantIds: number[] = [];
  for (const bo of boData) {
    const [tenant] = await db.insert(schema.tenants).values({
      name: bo.name,
      contactPerson: bo.name,
      status: 'ACTIVE'
    }).returning({ id: schema.tenants.id });
    
    await db.insert(schema.users).values({
      tenantId: tenant.id,
      name: bo.name,
      email: bo.email,
      contactNumber: '09' + Math.floor(100000000 + Math.random() * 900000000),
      passwordHash: passwordHash,
      role: 'BUSINESS_OWNER',
      status: 'ACTIVE'
    });
    tenantIds.push(tenant.id);
  }

  // 3. Create Customers
  console.log('Seeding Customers...');
  const firstNames = ['Juan', 'Maria', 'Jose', 'Anna', 'Pedro', 'Rosa', 'Luis', 'Carmen', 'Carlos', 'Lourdes', 'Miguel', 'Teresa', 'Antonio', 'Jocelyn'];
  const lastNames = ['Dela Cruz', 'Garcia', 'Reyes', 'Ramos', 'Mendoza', 'Santos', 'Flores', 'Gonzales', 'Bautista', 'Villanueva'];
  
  const customersPerTenant = 15;
  let custIndex = 0;
  for (const tenantId of tenantIds) {
    for (let i = 0; i < customersPerTenant; i++) {
      custIndex++;
      const fName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${fName} ${lName} ${custIndex}`;
      
      const [u] = await db.insert(schema.users).values({
        tenantId,
        name: name,
        firstName: fName,
        lastName: lName,
        email: `customer${custIndex}@example.com`,
        contactNumber: `09${Math.floor(100000000 + Math.random() * 900000000)}`,
        passwordHash,
        role: 'CUSTOMER',
        status: 'ACTIVE'
      }).returning({ id: schema.users.id, mobile: schema.users.contactNumber });

      await db.insert(schema.customers).values({
        tenantId,
        userId: u.id,
        name: name,
        contactPerson: name,
        mobileNumber: u.mobile!,
        email: `customer${custIndex}@example.com`,
        address: '123 Fake Street, Barangay Test',
        municipality: 'Quezon City',
        status: 'ACTIVE'
      });
    }
  }

  // 4. Create Products, Variants, Selling Units, Inventory
  console.log('Seeding Products and Inventory...');
  const productTemplates = [
    { name: 'Coca-Cola', cat: 'Beverages', variants: [{ v: '250 mL', p: 15, w: 0.25 }, { v: '500 mL', p: 30, w: 0.5 }, { v: '1 Liter', p: 60, w: 1 }] },
    { name: 'Sprite', cat: 'Beverages', variants: [{ v: '250 mL', p: 15, w: 0.25 }, { v: '1 Liter', p: 60, w: 1 }] },
    { name: 'Nature Spring Purified', cat: 'Water', variants: [{ v: '350 mL', p: 12, w: 0.35 }, { v: '1 Liter', p: 25, w: 1 }] },
    { name: 'Wilkins Distilled', cat: 'Water', variants: [{ v: '350 mL', p: 15, w: 0.35 }, { v: '1 Liter', p: 35, w: 1 }] },
    { name: 'Sinandomeng Rice', cat: 'Groceries', variants: [{ v: '1 kg', p: 55, w: 1 }, { v: '5 kg', p: 270, w: 5 }, { v: '25 kg', p: 1300, w: 25 }] },
    { name: 'Dinorado Rice', cat: 'Groceries', variants: [{ v: '1 kg', p: 65, w: 1 }, { v: '5 kg', p: 320, w: 5 }] },
    { name: 'Nescafe Classic', cat: 'Groceries', variants: [{ v: '50g', p: 45, w: 0.05 }, { v: '100g', p: 85, w: 0.1 }] },
    { name: 'Bear Brand Powdered Milk', cat: 'Groceries', variants: [{ v: '150g', p: 60, w: 0.15 }, { v: '300g', p: 115, w: 0.3 }] },
    { name: 'Century Tuna Flakes in Oil', cat: 'Canned Goods', variants: [{ v: '155g', p: 35, w: 0.15 }] },
    { name: '555 Sardines', cat: 'Canned Goods', variants: [{ v: '155g', p: 22, w: 0.15 }] },
    { name: 'Lucky Me Pancit Canton', cat: 'Snacks', variants: [{ v: '80g', p: 15, w: 0.08 }] },
    { name: 'Piattos Cheese', cat: 'Snacks', variants: [{ v: '40g', p: 18, w: 0.04 }, { v: '85g', p: 35, w: 0.085 }] },
    { name: 'Kopiko Brown Coffee', cat: 'Groceries', variants: [{ v: '25g', p: 8, w: 0.025 }] },
    { name: 'Gatorade Blue Bolt', cat: 'Beverages', variants: [{ v: '500 mL', p: 40, w: 0.5 }] },
    { name: 'C2 Apple', cat: 'Beverages', variants: [{ v: '355 mL', p: 25, w: 0.35 }] },
  ];

  for (const tenantId of tenantIds) {
    for (const pt of productTemplates) {
      const [prod] = await db.insert(schema.products).values({
        tenantId,
        name: pt.name,
        category: pt.cat,
        status: 'ACTIVE',
        isMarketplace: true
      }).returning({ id: schema.products.id });

      for (const vt of pt.variants) {
        const initialStock = 500;
        const [variant] = await db.insert(schema.productVariants).values({
          tenantId,
          productId: prod.id,
          name: vt.v,
          price: vt.p.toString(),
          stock: initialStock,
          weightPerPieceKg: vt.w.toString(),
          quota: 50,
          status: 'ACTIVE'
        }).returning({ id: schema.productVariants.id });

        // Seed Selling Units
        if (vt.v.includes('mL') || vt.v.includes('Liter')) {
          await db.insert(schema.productSellingUnits).values([
            { tenantId, productId: prod.id, variantId: variant.id, unitName: 'Piece', equivalentQty: '1', price: vt.p.toString(), status: 'ACTIVE' },
            { tenantId, productId: prod.id, variantId: variant.id, unitName: 'Case (24)', equivalentQty: '24', price: (vt.p * 23).toString(), status: 'ACTIVE' }
          ]);
        } else if (vt.v.includes('kg')) {
          await db.insert(schema.productSellingUnits).values([
            { tenantId, productId: prod.id, variantId: variant.id, unitName: 'Sack', equivalentQty: '1', price: vt.p.toString(), status: 'ACTIVE' }
          ]);
        } else {
          await db.insert(schema.productSellingUnits).values([
            { tenantId, productId: prod.id, variantId: variant.id, unitName: 'Piece', equivalentQty: '1', price: vt.p.toString(), status: 'ACTIVE' },
            { tenantId, productId: prod.id, variantId: variant.id, unitName: 'Pack (6)', equivalentQty: '6', price: (vt.p * 6).toString(), status: 'ACTIVE' }
          ]);
        }
      }
    }
  }

  console.log('--- Seeding Completed Successfully! ---');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed Error:', err);
  process.exit(1);
});
