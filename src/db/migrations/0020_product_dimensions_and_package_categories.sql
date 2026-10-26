-- Migration 0020: Product Dimensions, Weight, Vehicle Capacity, Package Categories & Base Fee Removal

-- 1. Add physical shipping dimensions and properties to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "length_cm" numeric(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "width_cm" numeric(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "height_cm" numeric(10, 2);
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "is_shippable" boolean DEFAULT true NOT NULL;

-- 2. Add physical shipping dimensions to product_variants (overrides parent if set)
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(10, 2);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "length_cm" numeric(10, 2);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "width_cm" numeric(10, 2);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "height_cm" numeric(10, 2);

-- Migrate existing weight_per_piece_kg to weight_kg if weight_kg is null
UPDATE "product_variants" 
SET "weight_kg" = "weight_per_piece_kg" 
WHERE "weight_kg" IS NULL AND "weight_per_piece_kg" IS NOT NULL AND "weight_per_piece_kg" > 0;

-- 3. Add physical shipping dimensions to product_selling_units
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "weight_kg" numeric(10, 2);
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "length_cm" numeric(10, 2);
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "width_cm" numeric(10, 2);
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "height_cm" numeric(10, 2);

-- 4. Add cargo dimensions to vehicles (Length, Width, Height in cm)
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "cargo_length_cm" numeric(10, 2) DEFAULT 0 NOT NULL;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "cargo_width_cm" numeric(10, 2) DEFAULT 0 NOT NULL;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "cargo_height_cm" numeric(10, 2) DEFAULT 0 NOT NULL;

-- Populate realistic default cargo dimensions for existing vehicle types if 0
UPDATE "vehicles"
SET 
  "cargo_length_cm" = CASE 
    WHEN LOWER("vehicle_type") LIKE '%motorcycle%' THEN 50
    WHEN LOWER("vehicle_type") LIKE '%sedan%' OR LOWER("vehicle_type") LIKE '%car%' THEN 100
    WHEN LOWER("vehicle_type") LIKE '%van%' OR LOWER("vehicle_type") LIKE '%mpv%' THEN 180
    WHEN LOWER("vehicle_type") LIKE '%pickup%' OR LOWER("vehicle_type") LIKE '%pick up%' THEN 220
    WHEN LOWER("vehicle_type") LIKE '%truck%' THEN 400
    ELSE 150
  END,
  "cargo_width_cm" = CASE 
    WHEN LOWER("vehicle_type") LIKE '%motorcycle%' THEN 40
    WHEN LOWER("vehicle_type") LIKE '%sedan%' OR LOWER("vehicle_type") LIKE '%car%' THEN 90
    WHEN LOWER("vehicle_type") LIKE '%van%' OR LOWER("vehicle_type") LIKE '%mpv%' THEN 120
    WHEN LOWER("vehicle_type") LIKE '%pickup%' OR LOWER("vehicle_type") LIKE '%pick up%' THEN 150
    WHEN LOWER("vehicle_type") LIKE '%truck%' THEN 200
    ELSE 100
  END,
  "cargo_height_cm" = CASE 
    WHEN LOWER("vehicle_type") LIKE '%motorcycle%' THEN 40
    WHEN LOWER("vehicle_type") LIKE '%sedan%' OR LOWER("vehicle_type") LIKE '%car%' THEN 80
    WHEN LOWER("vehicle_type") LIKE '%van%' OR LOWER("vehicle_type") LIKE '%mpv%' THEN 110
    WHEN LOWER("vehicle_type") LIKE '%pickup%' OR LOWER("vehicle_type") LIKE '%pick up%' THEN 120
    WHEN LOWER("vehicle_type") LIKE '%truck%' THEN 200
    ELSE 100
  END
WHERE "cargo_length_cm" = 0 OR "cargo_length_cm" IS NULL;

-- 5. Create package_categories table
CREATE TABLE IF NOT EXISTS "package_categories" (
  "id" serial PRIMARY KEY,
  "tenant_id" integer REFERENCES "tenants"("id") ON DELETE CASCADE,
  "code" varchar(50) NOT NULL UNIQUE,
  "name" varchar(100) NOT NULL,
  "max_length_cm" numeric(10, 2),
  "max_width_cm" numeric(10, 2),
  "max_height_cm" numeric(10, 2),
  "max_weight_kg" numeric(10, 2),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed standard reusable package categories
INSERT INTO "package_categories" ("code", "name", "max_length_cm", "max_width_cm", "max_height_cm", "max_weight_kg", "sort_order", "is_active")
VALUES 
  ('SMALL', 'Small', 25.00, 20.00, 10.00, 3.00, 1, true),
  ('MEDIUM', 'Medium', 40.00, 30.00, 20.00, 10.00, 2, true),
  ('LARGE', 'Large', 60.00, 45.00, 35.00, 25.00, 3, true),
  ('EXTRA_LARGE', 'Extra Large (XL)', 100.00, 70.00, 60.00, 50.00, 4, true),
  ('OVERSIZED', 'Oversized', 180.00, 120.00, 100.00, 200.00, 5, true),
  ('FREIGHT_CARGO', 'Freight / Cargo', 400.00, 250.00, 250.00, 5000.00, 6, true)
ON CONFLICT ("code") DO NOTHING;

-- 6. Add packed shipment dimensions and category to delivery_orders
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "packed_length_cm" numeric(10, 2);
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "packed_width_cm" numeric(10, 2);
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "packed_height_cm" numeric(10, 2);
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "package_category" varchar(50);
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "shipping_calculation_status" varchar(50) DEFAULT 'CALCULATED';
ALTER TABLE "delivery_orders" ADD COLUMN IF NOT EXISTS "shipping_rate_details" jsonb;

-- 7. Add dimensions to delivery_items
ALTER TABLE "delivery_items" ADD COLUMN IF NOT EXISTS "length_cm" numeric(10, 2);
ALTER TABLE "delivery_items" ADD COLUMN IF NOT EXISTS "width_cm" numeric(10, 2);
ALTER TABLE "delivery_items" ADD COLUMN IF NOT EXISTS "height_cm" numeric(10, 2);

-- 8. Reset base fee to 0 on vehicle_delivery_rates
ALTER TABLE "vehicle_delivery_rates" ALTER COLUMN "base_price" SET DEFAULT '0';
UPDATE "vehicle_delivery_rates" SET "base_price" = '0' WHERE "base_price" != '0';
