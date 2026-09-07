import 'dotenv/config';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import argon2 from '@node-rs/argon2';

async function seed() {
  console.log('--- Starting Database Cleanup ---');
  
  async function safeDelete(table: any) {
    try {
      await db.delete(table);
    } catch (e: any) {
      if (e.code === '42P01' || (e.cause && e.cause.code === '42P01')) {
        // Table does not exist, ignore
        console.log(`Skipping table... (does not exist)`);
      } else {
        throw e;
      }
    }
  }

  // 1. Delete in reverse dependency order (excluding users & tenants)
  console.log('Deleting dependent records...');
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

  console.log('--- Cleanup Complete! ---');
  
  // 2. Fetch existing tenants
  const existingTenants = await db.select().from(schema.tenants);
  if (existingTenants.length === 0) {
    console.error('No tenants found! Please ensure at least one tenant exists.');
    process.exit(1);
  }

  console.log('--- Starting Realistic Seeding ---');

  // Let's create realistic delivery partners
  const defaultPasswordHash = await argon2.hash('password123');
  
  console.log('Seeding Delivery Partners...');
  const [partner1] = await db.insert(schema.deliveryPartners).values({
    companyName: 'LBC Express',
    contactPerson: 'Juan Dela Cruz',
    mobileNumber: '09171234567',
    email: 'juan@lbcexpress.com',
    passwordHash: defaultPasswordHash,
    status: 'ACTIVE'
  }).returning();

  const [partner2] = await db.insert(schema.deliveryPartners).values({
    companyName: 'J&T Express',
    contactPerson: 'Maria Clara',
    mobileNumber: '09181234567',
    email: 'maria@jtexpress.ph',
    passwordHash: defaultPasswordHash,
    status: 'ACTIVE'
  }).returning();

  console.log('Seeding Drivers and Vehicles...');
  // For each tenant, seed drivers and vehicles linked to the partners
  for (const tenant of existingTenants) {
    // Drivers
    const [driver1] = await db.insert(schema.drivers).values({
      tenantId: tenant.id,
      deliveryPartnerId: partner1.id,
      name: 'Pedro Penduko',
      mobile: '09191234567',
      status: 'ACTIVE',
      licenseNumber: 'N11-12-123456',
      licenseExpiry: new Date('2028-12-31')
    }).returning();

    const [driver2] = await db.insert(schema.drivers).values({
      tenantId: tenant.id,
      deliveryPartnerId: partner2.id,
      name: 'Jose Rizal',
      mobile: '09201234567',
      status: 'ACTIVE',
      licenseNumber: 'N11-12-987654',
      licenseExpiry: new Date('2029-06-30')
    }).returning();

    // Vehicles
    const [vehicle1] = await db.insert(schema.vehicles).values({
      tenantId: tenant.id,
      deliveryPartnerId: partner1.id,
      plateNumber: 'ABC 1234',
      vehicleType: 'Closed Van',
      status: 'ACTIVE',
      registrationExpiry: new Date('2027-01-01')
    }).returning();

    const [vehicle2] = await db.insert(schema.vehicles).values({
      tenantId: tenant.id,
      deliveryPartnerId: partner2.id,
      plateNumber: 'XYZ 9876',
      vehicleType: 'Motorcycle',
      status: 'ACTIVE',
      registrationExpiry: new Date('2027-05-15')
    }).returning();

    console.log('Seeding Customers...');
    const [customer1] = await db.insert(schema.customers).values({
      tenantId: tenant.id,
      customerCode: 'CUST-SM-001',
      name: 'SM Mega Mall',
      contactPerson: 'Henry Sy Jr',
      mobileNumber: '09221234567',
      email: 'purchasing@smmegamall.com',
      address: 'EDSA corner J. Vargas Avenue, Mandaluyong',
      municipality: 'Mandaluyong',
      barangay: 'Wack-Wack',
      status: 'ACTIVE'
    }).returning();

    const [customer2] = await db.insert(schema.customers).values({
      tenantId: tenant.id,
      customerCode: 'CUST-GB-002',
      name: 'Greenbelt 5',
      contactPerson: 'Ayala Rep',
      mobileNumber: '09331234567',
      email: 'admin@greenbelt.ph',
      address: 'Legazpi Street, Legazpi Village, Makati',
      municipality: 'Makati',
      barangay: 'San Lorenzo',
      status: 'ACTIVE'
    }).returning();

    console.log('Seeding Products (Tech & Logistics oriented)...');
    const [product1] = await db.insert(schema.products).values({
      tenantId: tenant.id,
      name: 'Solar Panel 500W Monocrystalline',
      sku: 'SP-500-MONO',
      category: 'Solar',
      unit: 'pcs',
      price: '8500.00',
      stock: 120,
      lowStockThreshold: 20
    }).returning();

    const [product2] = await db.insert(schema.products).values({
      tenantId: tenant.id,
      name: 'Hybrid Inverter 5kW',
      sku: 'INV-5KW-HYB',
      category: 'Inverter',
      unit: 'pcs',
      price: '32000.00',
      stock: 45,
      lowStockThreshold: 10
    }).returning();

    const [product3] = await db.insert(schema.products).values({
      tenantId: tenant.id,
      name: 'LiFePO4 Battery 48V 100Ah',
      sku: 'BAT-48V-100AH',
      category: 'Battery',
      unit: 'pcs',
      price: '55000.00',
      stock: 15, // intentionally near low stock
      lowStockThreshold: 15
    }).returning();

    console.log('Seeding Realistic Delivery Orders...');
    
    // Create an order in PENDING state (future date)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    
    const [order1] = await db.insert(schema.deliveryOrders).values({
      tenantId: tenant.id,
      customerId: customer1.id,
      customerName: customer1.name,
      customerContact: customer1.mobileNumber,
      pickupAddress: 'Warehouse A, Taguig City',
      dropoffAddress: customer1.address,
      deliveryDate: futureDate,
      status: 'PENDING',
      offeredAmount: '1500.00',
      requiredVehicleType: 'Closed Van',
      distanceKm: '12.5'
    }).returning();

    // Attach items to order 1
    await db.insert(schema.deliveryItems).values([
      { deliveryOrderId: order1.id, productId: product1.id, quantity: 10, unit: 'pcs' },
      { deliveryOrderId: order1.id, productId: product2.id, quantity: 2, unit: 'pcs' }
    ]);

    // Create an order in ACCEPTED/ASSIGNED state
    const today = new Date();
    const [order2] = await db.insert(schema.deliveryOrders).values({
      tenantId: tenant.id,
      customerId: customer2.id,
      customerName: customer2.name,
      customerContact: customer2.mobileNumber,
      pickupAddress: 'Main Warehouse, Pasig City',
      dropoffAddress: customer2.address,
      deliveryDate: today,
      status: 'ACCEPTED', // or ASSIGNED
      offeredAmount: '850.00',
      requiredVehicleType: 'Motorcycle',
      distanceKm: '8.2',
      acceptedAt: today
    }).returning();

    await db.insert(schema.deliveryItems).values([
      { deliveryOrderId: order2.id, productId: product3.id, quantity: 1, unit: 'pcs' }
    ]);

    // Create assignment and invitation for order 2
    await db.insert(schema.deliveryInvitations).values({
      tenantId: tenant.id,
      deliveryOrderId: order2.id,
      deliveryPartnerId: partner1.id,
      tokenHash: 'mock-hash-1',
      status: 'ACCEPTED',
      expiresAt: new Date(today.getTime() + 86400000)
    });

    await db.insert(schema.deliveryAssignments).values({
      tenantId: tenant.id,
      deliveryOrderId: order2.id,
      deliveryPartnerId: partner1.id,
      driverName: driver1.name,
      vehicleDetails: vehicle1.plateNumber,
      status: 'ASSIGNED'
    });

    // Create an order in IN_TRANSIT state
    const [order3] = await db.insert(schema.deliveryOrders).values({
      tenantId: tenant.id,
      customerId: customer1.id,
      customerName: customer1.name,
      customerContact: customer1.mobileNumber,
      pickupAddress: 'Warehouse B, Quezon City',
      dropoffAddress: 'BGC, Taguig City',
      deliveryDate: today,
      status: 'IN_TRANSIT',
      offeredAmount: '2200.00',
      requiredVehicleType: 'Closed Van',
      distanceKm: '18.4',
      acceptedAt: today,
      startedAt: today,
      partnerDriverName: driver2.name,
      partnerDriverContact: driver2.mobile,
      preferredVehicle: vehicle2.plateNumber
    }).returning();

    await db.insert(schema.deliveryInvitations).values({
      tenantId: tenant.id,
      deliveryOrderId: order3.id,
      deliveryPartnerId: partner2.id,
      tokenHash: 'mock-hash-2',
      status: 'ACCEPTED',
      expiresAt: new Date(today.getTime() + 86400000)
    });

    // Create an order in COMPLETED state (yesterday)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const [order4] = await db.insert(schema.deliveryOrders).values({
      tenantId: tenant.id,
      customerId: customer2.id,
      customerName: customer2.name,
      customerContact: customer2.mobileNumber,
      pickupAddress: 'Main Warehouse, Pasig City',
      dropoffAddress: customer2.address,
      deliveryDate: yesterday,
      status: 'DELIVERED',
      offeredAmount: '3500.00',
      requiredVehicleType: 'Closed Van',
      distanceKm: '22.1',
      acceptedAt: yesterday,
      startedAt: yesterday,
      completedAt: yesterday,
      partnerDriverName: driver1.name,
      partnerDriverContact: driver1.mobile,
      preferredVehicle: vehicle1.plateNumber
    }).returning();

    await db.insert(schema.deliveryItems).values([
      { deliveryOrderId: order4.id, productId: product1.id, quantity: 20, unit: 'pcs' },
      { deliveryOrderId: order4.id, productId: product2.id, quantity: 5, unit: 'pcs' }
    ]);

  }

  console.log('--- Seeding Successfully Completed! ---');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
