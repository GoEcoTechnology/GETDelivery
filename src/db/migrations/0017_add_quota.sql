ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "quota" integer;
ALTER TABLE "product_selling_units" ADD COLUMN IF NOT EXISTS "quota" integer;
