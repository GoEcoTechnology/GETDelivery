ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "quantity" integer NOT NULL DEFAULT 1;

ALTER TABLE "product_selling_units"
  ADD COLUMN IF NOT EXISTS "description" text NOT NULL DEFAULT '';

ALTER TABLE "product_selling_units"
  DROP COLUMN IF EXISTS "stock",
  DROP COLUMN IF EXISTS "sku";