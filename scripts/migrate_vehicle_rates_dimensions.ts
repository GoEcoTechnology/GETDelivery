import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { db } from '../src/db/index';

async function main() {
  try {
    console.log('Inspecting columns of vehicle_delivery_rates...');
    const checkRes: any = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'vehicle_delivery_rates'
    `);
    console.log('Current columns:', checkRes.rows ? checkRes.rows.map((r: any) => r.column_name) : checkRes);

    console.log('Adding capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm if not exists...');
    await db.execute(sql`
      ALTER TABLE "vehicle_delivery_rates" 
      ADD COLUMN IF NOT EXISTS "capacity_kg" integer DEFAULT 0 NOT NULL,
      ADD COLUMN IF NOT EXISTS "cargo_length_cm" numeric(10, 2) DEFAULT '0' NOT NULL,
      ADD COLUMN IF NOT EXISTS "cargo_width_cm" numeric(10, 2) DEFAULT '0' NOT NULL,
      ADD COLUMN IF NOT EXISTS "cargo_height_cm" numeric(10, 2) DEFAULT '0' NOT NULL;
    `);

    // Backfill defaults if 0
    await db.execute(sql`
      UPDATE "vehicle_delivery_rates"
      SET 
        capacity_kg = CASE
          WHEN LOWER(vehicle_type) LIKE '%10 wheeler%' OR LOWER(vehicle_type) LIKE '%heavy truck%' OR LOWER(vehicle_type) LIKE '%truck%' THEN 5000
          WHEN LOWER(vehicle_type) LIKE '%travis%' OR LOWER(vehicle_type) LIKE '%van%' OR LOWER(vehicle_type) LIKE '%l300%' THEN 1000
          WHEN LOWER(vehicle_type) LIKE '%pick%' THEN 1000
          WHEN LOWER(vehicle_type) LIKE '%sedan%' OR LOWER(vehicle_type) LIKE '%car%' THEN 300
          WHEN LOWER(vehicle_type) LIKE '%motor%' THEN 20
          ELSE 100
        END,
        cargo_length_cm = CASE
          WHEN LOWER(vehicle_type) LIKE '%10 wheeler%' OR LOWER(vehicle_type) LIKE '%heavy truck%' THEN 600
          WHEN LOWER(vehicle_type) LIKE '%truck%' THEN 420
          WHEN LOWER(vehicle_type) LIKE '%travis%' OR LOWER(vehicle_type) LIKE '%van%' OR LOWER(vehicle_type) LIKE '%l300%' THEN 230
          WHEN LOWER(vehicle_type) LIKE '%pick%' THEN 200
          WHEN LOWER(vehicle_type) LIKE '%sedan%' OR LOWER(vehicle_type) LIKE '%car%' THEN 100
          WHEN LOWER(vehicle_type) LIKE '%motor%' THEN 40
          ELSE 100
        END,
        cargo_width_cm = CASE
          WHEN LOWER(vehicle_type) LIKE '%10 wheeler%' OR LOWER(vehicle_type) LIKE '%heavy truck%' THEN 240
          WHEN LOWER(vehicle_type) LIKE '%truck%' THEN 200
          WHEN LOWER(vehicle_type) LIKE '%travis%' OR LOWER(vehicle_type) LIKE '%van%' OR LOWER(vehicle_type) LIKE '%l300%' THEN 150
          WHEN LOWER(vehicle_type) LIKE '%pick%' THEN 150
          WHEN LOWER(vehicle_type) LIKE '%sedan%' OR LOWER(vehicle_type) LIKE '%car%' THEN 90
          WHEN LOWER(vehicle_type) LIKE '%motor%' THEN 40
          ELSE 80
        END,
        cargo_height_cm = CASE
          WHEN LOWER(vehicle_type) LIKE '%10 wheeler%' OR LOWER(vehicle_type) LIKE '%heavy truck%' THEN 240
          WHEN LOWER(vehicle_type) LIKE '%truck%' THEN 200
          WHEN LOWER(vehicle_type) LIKE '%travis%' OR LOWER(vehicle_type) LIKE '%van%' OR LOWER(vehicle_type) LIKE '%l300%' THEN 130
          WHEN LOWER(vehicle_type) LIKE '%pick%' THEN 100
          WHEN LOWER(vehicle_type) LIKE '%sedan%' OR LOWER(vehicle_type) LIKE '%car%' THEN 80
          WHEN LOWER(vehicle_type) LIKE '%motor%' THEN 40
          ELSE 80
        END
      WHERE capacity_kg = 0 OR cargo_length_cm = 0 OR cargo_width_cm = 0 OR cargo_height_cm = 0;
    `);

    const afterRes: any = await db.execute(sql`
      SELECT id, vehicle_type, price_per_km, capacity_kg, cargo_length_cm, cargo_width_cm, cargo_height_cm 
      FROM "vehicle_delivery_rates";
    `);
    console.log('Updated rates in DB:');
    console.table(afterRes.rows || afterRes);

    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  }
}

main();
