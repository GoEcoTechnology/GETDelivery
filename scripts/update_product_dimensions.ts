import 'dotenv/config';
import { db } from '../src/db';
import { products, productVariants, productSellingUnits } from '../src/db/schema';
import { eq } from 'drizzle-orm';

async function updateDimensions() {
  console.log('--- Updating Product, Variant & Selling Unit Dimensions in Database ---');

  const allProducts = await db.select().from(products);
  console.log(`Found ${allProducts.length} products to evaluate.`);

  for (const p of allProducts) {
    const vars = await db.select().from(productVariants).where(eq(productVariants.productId, p.id));
    
    let pWeight = '1.00';
    let pLength = '25.00';
    let pWidth = '20.00';
    let pHeight = '10.00';

    if (p.name.includes('Cement')) {
      pWeight = '40.00';
      pLength = '60.00';
      pWidth = '40.00';
      pHeight = '15.00';
    } else if (p.name.includes('Solar Panel')) {
      pWeight = '28.00';
      pLength = '227.00';
      pWidth = '113.00';
      pHeight = '3.50';
    } else if (p.name.includes('Inverter')) {
      pWeight = '25.00';
      pLength = '55.00';
      pWidth = '40.00';
      pHeight = '20.00';
    } else if (p.name.includes('Rebar')) {
      pWeight = '3.70';
      pLength = '600.00';
      pWidth = '10.00';
      pHeight = '10.00';
    } else if (p.name.includes('Corrugated Box')) {
      pWeight = '0.20';
      pLength = '30.00';
      pWidth = '20.00';
      pHeight = '15.00';
    } else if (p.name.includes('Packaging Tape') || p.name.includes('Tape')) {
      pWeight = '0.15';
      pLength = '12.00';
      pWidth = '12.00';
      pHeight = '5.00';
    }

    await db.update(products).set({
      weightKg: p.weightKg || pWeight,
      lengthCm: p.lengthCm || pLength,
      widthCm: p.widthCm || pWidth,
      heightCm: p.heightCm || pHeight,
      isShippable: true,
    }).where(eq(products.id, p.id));

    for (const v of vars) {
      let vWeight = v.weightKg || v.weightPerPieceKg || pWeight;
      let vLength = v.lengthCm || pLength;
      let vWidth = v.widthCm || pWidth;
      let vHeight = v.heightCm || pHeight;

      if (v.name.includes('40kg Bag')) {
        vWeight = '40.00';
        vLength = '60.00';
        vWidth = '40.00';
        vHeight = '15.00';
      } else if (v.name.includes('10kW')) {
        vWeight = '45.00';
        vLength = '65.00';
        vWidth = '50.00';
        vHeight = '25.00';
      } else if (v.name.includes('Large')) {
        vWeight = '0.40';
        vLength = '40.00';
        vWidth = '30.00';
        vHeight = '20.00';
      }

      await db.update(productVariants).set({
        weight: String(vWeight),
        weightKg: String(vWeight),
        weightPerPieceKg: String(vWeight),
        lengthCm: String(vLength),
        widthCm: String(vWidth),
        heightCm: String(vHeight),
      }).where(eq(productVariants.id, v.id));

      const sus = await db.select().from(productSellingUnits).where(eq(productSellingUnits.variantId, v.id));
      for (const su of sus) {
        let suWeight = su.weightKg || (Number(vWeight) * (Number(su.equivalentQty) || 1)).toString();
        let suLength = su.lengthCm || vLength;
        let suWidth = su.widthCm || vWidth;
        let suHeight = su.heightCm || vHeight;

        if (su.unitName.includes('Pallet of 50')) {
          suWeight = '2000.00';
          suLength = '120.00';
          suWidth = '100.00';
          suHeight = '100.00';
        } else if (su.unitName.includes('Pallet of 31')) {
          suWeight = '868.00';
          suLength = '230.00';
          suWidth = '115.00';
          suHeight = '125.00';
        } else if (su.unitName.includes('Pallet of 4')) {
          suWeight = '100.00';
          suLength = '120.00';
          suWidth = '80.00';
          suHeight = '80.00';
        } else if (su.unitName.includes('Bundle of 100')) {
          suWeight = '370.00';
          suLength = '600.00';
          suWidth = '20.00';
          suHeight = '20.00';
        } else if (su.unitName.includes('Bundle of 50')) {
          suWeight = '10.00';
          suLength = '60.00';
          suWidth = '50.00';
          suHeight = '30.00';
        } else if (su.unitName.includes('Box of 24')) {
          suWeight = '3.60';
          suLength = '36.00';
          suWidth = '24.00';
          suHeight = '15.00';
        }

        await db.update(productSellingUnits).set({
          weight: String(suWeight),
          weightKg: String(suWeight),
          lengthCm: String(suLength),
          widthCm: String(suWidth),
          heightCm: String(suHeight),
        }).where(eq(productSellingUnits.id, su.id));
      }
    }
  }

  console.log('✅ Successfully updated all product dimensions in database!');
  process.exit(0);
}

updateDimensions().catch(err => {
  console.error('Error updating dimensions:', err);
  process.exit(1);
});
