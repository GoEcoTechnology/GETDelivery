import { db } from '../src/db';
import { products, productVariants, productSellingUnits } from '../src/db/schema';
import { sql } from 'drizzle-orm';

async function seedProducts() {
  console.log('Clearing old products and seeding new ones...');

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

  // Find all tenants
  const allTenants = await db.select().from(require('../src/db/schema').tenants);
  if (allTenants.length === 0) {
    console.error('No tenants found in database.');
    process.exit(1);
  }

  for (let i = 0; i < allTenants.length; i++) {
    const tenant = allTenants[i];
    const tenantId = tenant.id;
    console.log(`Seeding products for tenant ${tenant.name} (ID: ${tenantId})...`);

    if (i % 3 === 0) {
      // Catalog 1: Solar Equipment
      const [inverter] = await db.insert(products).values({
        tenantId, name: 'Hybrid Solar Inverter', category: 'Solar',
        description: 'High efficiency solar inverter', lowStockThreshold: 10, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const invVars = await db.insert(productVariants).values([
        { tenantId, productId: inverter.id, name: '5kW Single Phase', quantity: 1, unit: 'Piece', price: '45000', stock: 100, lowStockThreshold: 10, quota: 10, weightPerPieceKg: '25', status: 'ACTIVE' },
        { tenantId, productId: inverter.id, name: '10kW Three Phase', quantity: 1, unit: 'Piece', price: '85000', stock: 50, lowStockThreshold: 5, quota: 5, weightPerPieceKg: '45', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: inverter.id, variantId: invVars[0].id, unitName: 'Pallet of 4', description: '4 Inverters per pallet', equivalentQty: '4', price: '175000', status: 'ACTIVE'
      });

      const [panel] = await db.insert(products).values({
        tenantId, name: 'Monocrystalline Solar Panel', category: 'Solar',
        description: '550W High efficiency panel', lowStockThreshold: 50, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const panelVars = await db.insert(productVariants).values([
        { tenantId, productId: panel.id, name: '550W Tier 1', quantity: 1, unit: 'Piece', price: '6500', stock: 1000, lowStockThreshold: 100, quota: 50, weightPerPieceKg: '28', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: panel.id, variantId: panelVars[0].id, unitName: 'Pallet of 31', description: '31 Panels per pallet', equivalentQty: '31', price: '198000', status: 'ACTIVE'
      });
      
    } else if (i % 3 === 1) {
      // Catalog 2: Construction Hardware
      const [cement] = await db.insert(products).values({
        tenantId, name: 'Portland Cement', category: 'Construction',
        description: 'Premium portland cement type 1', lowStockThreshold: 100, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const cemVars = await db.insert(productVariants).values([
        { tenantId, productId: cement.id, name: '40kg Bag', quantity: 1, unit: 'Bag', price: '250', stock: 2000, lowStockThreshold: 200, quota: 100, weightPerPieceKg: '40', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: cement.id, variantId: cemVars[0].id, unitName: 'Pallet of 50', description: '50 bags per pallet', equivalentQty: '50', price: '12000', status: 'ACTIVE'
      });

      const [rebar] = await db.insert(products).values({
        tenantId, name: 'Steel Rebar 10mm', category: 'Construction',
        description: 'Standard 10mm deformed steel rebar', lowStockThreshold: 200, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const rebarVars = await db.insert(productVariants).values([
        { tenantId, productId: rebar.id, name: '6 Meter Length', quantity: 1, unit: 'Piece', price: '180', stock: 3000, lowStockThreshold: 500, quota: 200, weightPerPieceKg: '3.7', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: rebar.id, variantId: rebarVars[0].id, unitName: 'Bundle of 100', description: '100 pieces per bundle', equivalentQty: '100', price: '17500', status: 'ACTIVE'
      });

    } else {
      // Catalog 3: Packaging Supplies
      const [box] = await db.insert(products).values({
        tenantId, name: 'Corrugated Box', category: 'Packaging',
        description: 'Sturdy packaging box', lowStockThreshold: 200, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const boxVars = await db.insert(productVariants).values([
        { tenantId, productId: box.id, name: 'Medium (30x20x15)', quantity: 1, unit: 'Piece', price: '25', stock: 5000, lowStockThreshold: 500, quota: 100, weightPerPieceKg: '0.2', status: 'ACTIVE' },
        { tenantId, productId: box.id, name: 'Large (40x30x20)', quantity: 1, unit: 'Piece', price: '40', stock: 3000, lowStockThreshold: 300, quota: 50, weightPerPieceKg: '0.4', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: box.id, variantId: boxVars[0].id, unitName: 'Bundle of 50', description: '50 boxes tied together', equivalentQty: '50', price: '1200', status: 'ACTIVE'
      });

      const [tape] = await db.insert(products).values({
        tenantId, name: 'Packaging Tape', category: 'Packaging',
        description: 'Clear packaging tape 50m', lowStockThreshold: 50, status: 'ACTIVE', isMarketplace: true
      }).returning();

      const tapeVars = await db.insert(productVariants).values([
        { tenantId, productId: tape.id, name: 'Clear 2-inch', quantity: 1, unit: 'Roll', price: '35', stock: 1000, lowStockThreshold: 100, quota: 50, weightPerPieceKg: '0.15', status: 'ACTIVE' }
      ]).returning();

      await db.insert(productSellingUnits).values({
        tenantId, productId: tape.id, variantId: tapeVars[0].id, unitName: 'Box of 24', description: '24 rolls per box', equivalentQty: '24', price: '800', status: 'ACTIVE'
      });
    }
  }

  console.log('Successfully seeded products and selling units!');
  process.exit(0);
}

seedProducts().catch(console.error);
