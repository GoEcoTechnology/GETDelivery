import 'dotenv/config';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import argon2 from '@node-rs/argon2';

async function seed() {
  console.log('--- Starting Database Cleanup for Volume Seed ---');
  
  async function safeDelete(table: any) {
    try {
      await db.delete(table);
    } catch (e: any) {
      if (e.code === '42P01' || (e.cause && e.cause.code === '42P01')) {
        console.log(`Skipping table... (does not exist)`);
      } else {
        throw e;
      }
    }
  }

  console.log('Deleting previous records...');
  await safeDelete(schema.quotaAccumulations);
  await safeDelete(schema.productQuotas);
  await safeDelete(schema.notifications);
  await safeDelete(schema.auditLogs);
  await safeDelete(schema.deliveryAssignments);
  await safeDelete(schema.deliveryInvitations);
  await safeDelete(schema.deliveryItems);
  await safeDelete(schema.stockIns);
  await safeDelete(schema.stockOuts);
  await safeDelete(schema.inventoryTransactions);
  await safeDelete(schema.deliveryOrders);
  await safeDelete(schema.deliveryBatches);
  await safeDelete(schema.vehicles);
  await safeDelete(schema.drivers);
  await safeDelete(schema.deliveryPartners);
  await safeDelete(schema.customers);
  await safeDelete(schema.products);

  const existingTenants = await db.select().from(schema.tenants);
  if (existingTenants.length === 0) {
    console.error('No tenants found!');
    process.exit(1);
  }

  console.log('--- Seeding High Volume Data ---');
  const defaultPasswordHash = await argon2.hash('password123');

  // 1. Create 5 Delivery Partners
  const partnerData = [
    { name: 'LBC Express', email: 'lbc@test.com', phone: '09170000001' },
    { name: 'J&T Express', email: 'jt@test.com', phone: '09170000002' },
    { name: 'Ninja Van', email: 'ninja@test.com', phone: '09170000003' },
    { name: '2GO Express', email: '2go@test.com', phone: '09170000004' },
    { name: 'Flash Express', email: 'flash@test.com', phone: '09170000005' },
  ];
  
  const insertedPartners = [];
  for (const p of partnerData) {
    const [inserted] = await db.insert(schema.deliveryPartners).values({
      companyName: p.name,
      contactPerson: p.name + ' Admin',
      mobileNumber: p.phone,
      email: p.email,
      passwordHash: defaultPasswordHash,
      status: 'ACTIVE'
    }).returning();
    insertedPartners.push(inserted);
  }

  // Generate 15 customers per tenant
  const customerNames = [
    'SM Mega Mall', 'Greenbelt 5', 'Trinoma', 'Ayala Malls Manila Bay', 'Glorietta',
    'Robinsons Magnolia', 'UP Town Center', 'Market Market', 'Venice Grand Canal', 'Power Plant Mall',
    'Festival Supermall', 'Alabang Town Center', 'Eastwood Mall', 'Uptown Mall BGC', 'SM North EDSA'
  ];
  
  const productData = [
    { name: 'Solar Panel 500W', price: 8500, stock: 150 },
    { name: 'Hybrid Inverter 5kW', price: 32000, stock: 45 },
    { name: 'LiFePO4 Battery 100Ah', price: 55000, stock: 20 },
    { name: 'Solar Charge Controller 60A', price: 5500, stock: 80 },
    { name: 'MC4 Connectors (Pair)', price: 150, stock: 1000 },
    { name: 'PV Cable 4mm (per meter)', price: 45, stock: 5000 },
    { name: 'DC Breaker 63A', price: 450, stock: 200 },
    { name: 'AC Surge Protector', price: 1200, stock: 150 },
    { name: 'Grounding Rod 5ft', price: 850, stock: 75 },
    { name: 'Battery Rack Cabinet', price: 12500, stock: 10 },
    { name: 'Off-Grid Inverter 3kW', price: 21000, stock: 25 },
    { name: 'Deep Cycle Gel Battery 200Ah', price: 18500, stock: 40 },
    { name: 'Mounting Rail 2m', price: 650, stock: 300 },
    { name: 'Mid Clamp Assembly', price: 85, stock: 800 },
    { name: 'End Clamp Assembly', price: 90, stock: 800 }
  ];

  for (const tenant of existingTenants) {
    // Insert Drivers & Vehicles for each partner
    const tenantDrivers = [];
    const tenantVehicles = [];
    
    for (const partner of insertedPartners) {
      // 2 drivers per partner
      for (let i = 1; i <= 2; i++) {
        const [d] = await db.insert(schema.drivers).values({
          tenantId: tenant.id,
          deliveryPartnerId: partner.id,
          name: `${partner.companyName} Driver ${i}`,
          mobile: `0920000${partner.id}${i}`,
          status: 'ACTIVE'
        }).returning();
        tenantDrivers.push(d);

        const [v] = await db.insert(schema.vehicles).values({
          tenantId: tenant.id,
          deliveryPartnerId: partner.id,
          plateNumber: `PLT-${partner.id}-${i}`,
          vehicleType: i === 1 ? 'Closed Van' : 'Motorcycle',
          status: 'ACTIVE'
        }).returning();
        tenantVehicles.push(v);
      }
    }

    const insertedCustomers = [];
    for (let i = 0; i < customerNames.length; i++) {
      const [c] = await db.insert(schema.customers).values({
        tenantId: tenant.id,
        customerCode: `CUST-${tenant.id}-${i}`,
        name: customerNames[i],
        mobileNumber: `0999000${i.toString().padStart(4, '0')}`,
        address: `Generic Address ${i}, Metro Manila`,
        status: 'ACTIVE'
      }).returning();
      insertedCustomers.push(c);
    }

    const insertedProducts = [];
    for (const p of productData) {
      const [prod] = await db.insert(schema.products).values({
        tenantId: tenant.id,
        name: p.name,
        price: p.price.toString(),
        stock: p.stock,
        lowStockThreshold: 10,
        status: 'ACTIVE'
      }).returning();
      insertedProducts.push(prod);
    }

    console.log(`Generating 50 orders for tenant ${tenant.id}...`);
    // Generate 50 orders (Past, Present, Future)
    for (let i = 0; i < 50; i++) {
      // Determine date (-15 to +15 days from now)
      const offsetDays = Math.floor(Math.random() * 30) - 15;
      const orderDate = new Date();
      orderDate.setDate(orderDate.getDate() + offsetDays);

      let status = 'DELIVERED';
      if (offsetDays > 0) {
        status = Math.random() > 0.5 ? 'PENDING' : 'ACCEPTED';
      } else if (offsetDays === 0) {
        status = Math.random() > 0.5 ? 'IN_TRANSIT' : 'DELIVERED';
      } else if (offsetDays === -1 || offsetDays === -2) {
         status = Math.random() > 0.8 ? 'IN_TRANSIT' : 'DELIVERED';
      } else {
        status = 'DELIVERED';
      }

      const cust = insertedCustomers[Math.floor(Math.random() * insertedCustomers.length)];
      
      const [order] = await db.insert(schema.deliveryOrders).values({
        tenantId: tenant.id,
        customerId: cust.id,
        customerName: cust.name,
        customerContact: cust.mobileNumber,
        pickupAddress: 'Main Central Warehouse',
        dropoffAddress: cust.address,
        deliveryDate: orderDate,
        status: status,
        offeredAmount: (Math.random() * 3000 + 500).toFixed(2).toString(),
        createdAt: orderDate // Backdate creation somewhat
      }).returning();

      // Items
      const numItems = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < numItems; j++) {
        const prod = insertedProducts[Math.floor(Math.random() * insertedProducts.length)];
        await db.insert(schema.deliveryItems).values({
          deliveryOrderId: order.id,
          productId: prod.id,
          quantity: Math.floor(Math.random() * 5) + 1,
          unit: 'pcs'
        });
      }

      // If assigned or delivered, attach a partner
      if (status !== 'PENDING') {
        const partner = insertedPartners[Math.floor(Math.random() * insertedPartners.length)];
        // find drivers/vehicles belonging to this partner
        const pDrivers = tenantDrivers.filter(d => d.deliveryPartnerId === partner.id);
        const pVehicles = tenantVehicles.filter(v => v.deliveryPartnerId === partner.id);
        
        await db.insert(schema.deliveryAssignments).values({
          tenantId: tenant.id,
          deliveryOrderId: order.id,
          deliveryPartnerId: partner.id,
          driverName: pDrivers[0].name,
          vehicleDetails: pVehicles[0].plateNumber,
          status: status === 'DELIVERED' ? 'COMPLETED' : 'ASSIGNED'
        });
        
        // Add invite record
        await db.insert(schema.deliveryInvitations).values({
          tenantId: tenant.id,
          deliveryOrderId: order.id,
          deliveryPartnerId: partner.id,
          tokenHash: `mock-hash-${i}`,
          status: 'ACCEPTED',
          expiresAt: new Date(orderDate.getTime() + 86400000)
        });
      }
    }
  }

  console.log('--- Volume Seeding Complete! ---');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
