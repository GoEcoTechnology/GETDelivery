import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { eq, or } from 'drizzle-orm';
import * as dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

async function seedProducts() {
  console.log('Seeding company products...');

  // Get 2 tenants (business owners)
  const allTenants = await db.query.tenants.findMany({
    limit: 2,
    orderBy: (t, { asc }) => [asc(t.id)],
  });

  if (allTenants.length === 0) {
    console.log('No tenants found.');
    process.exit(1);
  }

  // Delete existing products for these tenants to prevent duplicates
  for (const tenant of allTenants) {
    await db.delete(schema.products).where(eq(schema.products.tenantId, tenant.id));
  }

  const productsData = [
    {
      name: 'Lithium Battery Pack',
      category: 'Energy Storage',
      description: 'High capacity lithium-ion battery for solar storage.',
      variants: [
        { 
          name: '48V 100Ah', price: 45000, stock: 50, weight: '45',
          units: [{ name: 'Pallet of 4', description: '4 units per pallet', qty: 4, price: 175000, weight: '180' }]
        },
        { 
          name: '48V 200Ah', price: 85000, stock: 30, weight: '90',
          units: []
        },
      ]
    },
    {
      name: 'Hybrid Solar Inverter',
      category: 'Power Electronics',
      description: '5kW Hybrid inverter with built-in MPPT controller.',
      variants: [
        { 
          name: '5kW Single Phase', price: 32000, stock: 120, weight: '12',
          units: [{ name: 'Box of 5', description: 'Wholesale box of 5 inverters', qty: 5, price: 155000, weight: '60' }]
        },
        { 
          name: '10kW Three Phase', price: 58000, stock: 45, weight: '24',
          units: []
        },
      ]
    },
    {
      name: 'Industrial LED High Bay Light',
      category: 'Lighting',
      description: 'Energy-efficient LED lighting for warehouses and factories.',
      variants: [
        { 
          name: '150W 6000K', price: 2500, stock: 300, weight: '2.5',
          units: [{ name: 'Carton of 10', description: 'Standard carton', qty: 10, price: 24000, weight: '25' }]
        },
        { 
          name: '200W 6000K', price: 3200, stock: 200, weight: '3.2',
          units: [{ name: 'Carton of 10', description: 'Standard carton', qty: 10, price: 31000, weight: '32' }]
        },
      ]
    },
    {
      name: 'Heavy Duty Extension Cord',
      category: 'Electrical Supplies',
      description: 'Commercial grade extension cord with 4 outlets.',
      variants: [
        { 
          name: '10 Meters', price: 850, stock: 500, weight: '1.5',
          units: [{ name: 'Bundle of 20', description: 'Bundle packaged', qty: 20, price: 16000, weight: '30' }]
        },
        { 
          name: '25 Meters', price: 1800, stock: 250, weight: '3.5',
          units: [{ name: 'Bundle of 10', description: 'Bundle packaged', qty: 10, price: 17000, weight: '35' }]
        },
      ]
    }
  ];

  for (const tenant of allTenants) {
    console.log(`\nSeeding products for tenant: ${tenant.name}`);

    for (const prod of productsData) {
      // Insert product
      const [insertedProduct] = await db.insert(schema.products).values({
        tenantId: tenant.id,
        name: prod.name,
        category: prod.category,
        description: prod.description,
        isMarketplace: true,
        status: 'ACTIVE',
      }).returning();

      console.log(`Created product: ${insertedProduct.name}`);

      // Insert variants
      for (const v of prod.variants) {
        const [insertedVariant] = await db.insert(schema.productVariants).values({
          tenantId: tenant.id,
          productId: insertedProduct.id,
          name: v.name,
          price: v.price.toString(),
          stock: v.stock,
          weight: v.weight,
          weightPerPieceKg: v.weight,
          quantity: 1, // base qty
          quota: 100,
          status: 'ACTIVE',
        }).returning();
        
        console.log(`  Created variant: ${insertedVariant.name}`);
        
        // Insert proper selling units (wholesale boxes, bundles)
        for (const u of v.units) {
          await db.insert(schema.productSellingUnits).values({
            tenantId: tenant.id,
            productId: insertedProduct.id,
            variantId: insertedVariant.id,
            unitName: u.name,
            description: u.description,
            equivalentQty: u.qty.toString(),
            price: u.price.toString(),
            weight: u.weight,
            status: 'ACTIVE',
          });
          console.log(`    Created selling unit: ${u.name}`);
        }
      }
    }
  }

  console.log('\nSeeding complete.');
  process.exit(0);
}

seedProducts().catch(err => {
  console.error(err);
  process.exit(1);
});
