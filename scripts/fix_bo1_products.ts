import 'dotenv/config';
import { db } from '../src/db';
import * as schema from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function run() {
  console.log('Fetching BO 1...');
  const [bo1User] = await db.select().from(schema.users).where(eq(schema.users.email, 'anjeloqp@gmail.com'));
  
  if (!bo1User || !bo1User.tenantId) {
    console.error('BO 1 not found or has no tenant.');
    process.exit(1);
  }
  
  const tenantId = bo1User.tenantId;
  console.log(`BO 1 Tenant ID: ${tenantId}. Deleting existing products...`);
  
  // Delete all products for this tenant (cascades or we manually delete dependents)
  // Delete selling units first
  await db.delete(schema.productSellingUnits).where(eq(schema.productSellingUnits.tenantId, tenantId));
  // Delete variants
  await db.delete(schema.productVariants).where(eq(schema.productVariants.tenantId, tenantId));
  // Delete products
  await db.delete(schema.products).where(eq(schema.products.tenantId, tenantId));
  
  console.log('Seeding new distinct products for BO 1...');
  const productTemplates = [
    { name: 'Pepsi', cat: 'Beverages', variants: [{ v: '250 mL', p: 15, w: 0.25 }, { v: '1 Liter', p: 60, w: 1 }] },
    { name: 'Mountain Dew', cat: 'Beverages', variants: [{ v: '250 mL', p: 15, w: 0.25 }, { v: '1 Liter', p: 60, w: 1 }] },
    { name: 'Absolute Distilled Water', cat: 'Water', variants: [{ v: '350 mL', p: 15, w: 0.35 }, { v: '1 Liter', p: 35, w: 1 }] },
    { name: 'Summit Natural Drinking Water', cat: 'Water', variants: [{ v: '350 mL', p: 12, w: 0.35 }, { v: '1 Liter', p: 25, w: 1 }] },
    { name: 'Jasmine Rice', cat: 'Groceries', variants: [{ v: '1 kg', p: 70, w: 1 }, { v: '5 kg', p: 340, w: 5 }, { v: '25 kg', p: 1650, w: 25 }] },
    { name: 'Milo Powdered Choco', cat: 'Groceries', variants: [{ v: '300g', p: 95, w: 0.3 }] },
    { name: 'Ovaltine', cat: 'Groceries', variants: [{ v: '300g', p: 90, w: 0.3 }] },
    { name: 'San Marino Corned Tuna', cat: 'Canned Goods', variants: [{ v: '180g', p: 45, w: 0.18 }] },
    { name: 'Argentina Corned Beef', cat: 'Canned Goods', variants: [{ v: '150g', p: 38, w: 0.15 }, { v: '260g', p: 65, w: 0.26 }] },
    { name: 'Nissin Seafood Cup Noodles', cat: 'Snacks', variants: [{ v: '70g', p: 28, w: 0.07 }] },
    { name: 'Payless Pancit Canton', cat: 'Snacks', variants: [{ v: '65g', p: 12, w: 0.065 }] },
    { name: 'Nova Multigrain Snacks', cat: 'Snacks', variants: [{ v: '78g', p: 30, w: 0.078 }] },
    { name: 'Chippy BBQ', cat: 'Snacks', variants: [{ v: '110g', p: 35, w: 0.11 }] },
    { name: 'Pocari Sweat', cat: 'Beverages', variants: [{ v: '500 mL', p: 45, w: 0.5 }] },
    { name: 'Purefoods Tender Juicy Hotdog', cat: 'Frozen', variants: [{ v: '500g', p: 180, w: 0.5 }, { v: '1 kg', p: 350, w: 1 }] },
  ];

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
      } else if (vt.v.includes('kg') && pt.cat !== 'Frozen') {
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

  console.log('Successfully re-seeded products for BO 1!');
  process.exit(0);
}
run();
